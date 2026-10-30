/**
 * 公共接口（所有业务共用）
 *
 * 当前包含：
 *   - 支付宝支付   POST /public/payment
 *   - 支付宝回调   POST /public/notify
 *   - 支付宝退款   POST /public/refund
 *   - 图片上传     POST /public/uploadImg
 *   - 图片删除     POST /public/deleteImg
 *
 * 设计说明：
 *   1. payment / notify / uploadImg / deleteImg 与业务无关，所有业务共用同一接口
 *   2. refund 通过 refundHandlers 注册表适配各业务（票务/套餐/酒店/停车/夏令），
 *      新增业务只需要在注册表中加一项配置，无需修改 refund 主体逻辑
 *
 * 后续新增业务（停车/夏令等）接入退款步骤：
 *   1. 创建对应订单 Model
 *   2. 实现 calcRefund（退款金额计算）和 restoreStock（库存恢复）
 *   3. 在 refundHandlers 中加一项配置（参考已有的 ticket/package/hotel）
 */
const express = require('express');
const router = express.Router();
const { sequelize } = require("../../../mysql/index");
const util = require("../../../utils/util");
const { generateNights } = require("../../../utils/dateHelper");
const { Member, User, Order, RefundOrder, PackageOrderDetail, HotelOrder,
    Ticket, RoomInventory, ParkingReservation, campOrders } = require("../../../models/Summary");
const queueService = require("../../../services/queueService");
const paymentService = require("../../../services/paymentService");
const { singleFileUpload, deleteImage } = require("../../../utils/aliyun");
const redisService = require("../../../services/redisService");
const ticketPurchaseService = require("../../../services/ticketPurchaseService");
const hotelPurchaseService = require("../../../services/hotelPurchaseService");
const comboPurchaseService = require("../../../services/comboPurchaseService");


// ============================================================
//  支付宝支付（PC 网站支付）
// ============================================================
/**
 * 业务方下单拿到 outTradeNo 后调用此接口换取支付页面 URL
 * 通用入口：票务/酒店/套餐/停车/夏令等所有业务共用
 * 
 * outTradeNo: 业务方订单号
 * subject: 商品标题
 * totalAmount: 商品总金额
 */
exports.payment = async (req, res) => {
    try {
        let { outTradeNo, subject, totalAmount, order } = req.body;

        // 校验参数
        if (!outTradeNo || !subject || !totalAmount) {
            return res.json(util.fail('参数错误'));
        }

        let orderType = [{
            type: "ticket",
            module: Order
        }, {
            type: "hotel",
            module: HotelOrder
        }, {
            type: "parking",
            module: ParkingReservation
        }, {
            type: "summerCamp",
            module: campOrders
        }]
        console.log("订单信息", outTradeNo, subject, totalAmount, order)

        let orderModel = orderType.find(item => item.type === order)

        console.log("订单信息库", orderModel)
        orderInfo = await orderModel.module.findOne({ where: { orderNumber: outTradeNo } });

        console.log("订单信息", orderInfo)
        if (!orderInfo) {
            return res.json(util.fail('订单不存在或创建失败 请联系客服'));
        }

        const payUrl = await paymentService.createPagePay({
            outTradeNo: orderInfo.orderNumber, //  业务方订单号
            subject: orderInfo.title, // 商品标题
            totalAmount: orderInfo.orderAmount, // 商品价格
            notifyUrl: 'http://vcc37a6e.natappfree.cc/api/public/notify',
            returnUrl: 'http://localhost:8081/order',
        });

        res.json(util.success("支付成功", payUrl));

    } catch (error) {
        console.error("支付失败:", error);
        res.status(500).json({
            code: 500,
            message: error.message
        });
    }
};


// ============================================================
//  支付宝回调（发送队列处理）
// ============================================================
exports.notify = async (req, res) => {
    try {
        // 验证签名（统一走 paymentService）
        const signVerified = paymentService.verifyNotifySign(req.body);
        if (!signVerified) {
            console.error("[Notify] 签名验证失败");
            return res.send('fail');
        }

        const { out_trade_no, trade_status, total_amount } = req.body;

        console.log(`[Notify] 支付回调: ${out_trade_no}, 状态: ${trade_status}`);

        // 发送支付回调到队列异步处理
        await queueService.addPaymentJob({
            out_trade_no,
            trade_status,
            total_amount,
            notifyData: req.body,
        });

        // 立即返回success，不等待处理
        return res.send('success');

    } catch (error) {
        console.error("[Notify] 回调处理错误:", error);
        return res.send('failure');
    }
};


// ============================================================
//  支付宝主动查询补单（returnUrl 跳回时调用，第二道保险）
// ============================================================
/**
 * 用途：用户从支付宝支付页跳回 returnUrl 时，前端立即调此接口
 *      后端主动调支付宝 queryTrade 查询真实支付状态，若已支付但本地订单仍为待支付，
 *      则把任务塞入 paymentQueue，由 orderWorker 走和 notify 一样的流程补单
 *
 *      notify 异步回调可能丢失（natapp 掉线等），此接口是兜底补单机制
 *
 * 入参：query.outTradeNo 订单号
 */
exports.queryPayStatus = async (req, res) => {
    try {
        const { outTradeNo } = req.query;
        if (!outTradeNo) {
            return res.json(util.fail('订单号不能为空'));
        }

        // 1. 在 refundHandlers 注册表中查找订单（与 refund 同一策略）
        let order = null;
        let matchedHandler = null;
        for (const [type, handler] of Object.entries(refundHandlers)) {
            order = await handler.model.findOne({ where: { orderNumber: outTradeNo } });
            if (order) {
                matchedHandler = handler;
                break;
            }
        }

        if (!order) {
            return res.json(util.fail('订单不存在'));
        }

        // 2. 检查本地订单状态：若已不是"待支付"(payStatus!==1)，直接返回当前状态
        const currentStatus = order[matchedHandler.statusField];
        if (currentStatus !== 1) {
            return res.json(util.success('订单已处理', {
                orderNumber: outTradeNo,
                localStatus: currentStatus,
                alreadyPaid: [2, 3].includes(currentStatus),
                queued: false,
            }));
        }

        // 3. 本地仍为待支付 → 主动调支付宝 queryTrade
        const queryResult = await paymentService.queryTrade({ outTradeNo });

        console.log('[QueryPayStatus] 支付宝查询结果:', outTradeNo, queryResult);

        // 支付宝查询失败
        if (queryResult.code !== '10000') {
            return res.json(util.success('支付宝查询失败', {
                orderNumber: outTradeNo,
                localStatus: currentStatus,
                alipayCode: queryResult.code,
                alipayMsg: queryResult.msg,
                queued: false,
            }));
        }

        const tradeStatus = queryResult.tradeStatus;

        // 4. 已支付 → 塞入 paymentQueue 走和 notify 一样的流程补单
        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            await queueService.addPaymentJob({
                out_trade_no: outTradeNo,
                trade_status: tradeStatus,
                total_amount: queryResult.totalAmount,
                notifyData: {
                    out_trade_no: outTradeNo,
                    trade_no: queryResult.tradeNo,
                    trade_status: tradeStatus,
                    total_amount: queryResult.totalAmount,
                    gmt_payment: queryResult.sendPayDate || new Date().toISOString(),
                },
            });

            console.log(`[QueryPayStatus] 补单任务已入队: ${outTradeNo} (${tradeStatus})`);
            return res.json(util.success('支付已确认，正在补单', {
                orderNumber: outTradeNo,
                tradeStatus,
                tradeNo: queryResult.tradeNo,
                totalAmount: queryResult.totalAmount,
                alreadyPaid: true,
                queued: true,
            }));
        }

        // 5. 未支付 / 已关闭 / 等待付款
        return res.json(util.success('订单未支付', {
            orderNumber: outTradeNo,
            tradeStatus,
            alreadyPaid: false,
            queued: false,
        }));

    } catch (error) {
        console.error('[QueryPayStatus] 查询失败:', error);
        return res.json(util.fail('查询失败', error.message));
    }
};


// ============================================================
//  退款相关：辅助函数
// ============================================================

/**
 * 酒店退款阶梯规则计算
 * 规则（按入住日与今天的自然日差值 diffDays）：
 *   diffDays >= 5  → 退款 100%（免费取消）
 *   diffDays == 4  → 退款 70%，扣 30%
 *   diffDays == 3  → 退款 50%，扣 50%
 *   diffDays == 2  → 退款 20%，扣 80%
 *   diffDays <= 1  → 不可普通退款（入住前1天/当天/已过期）
 */
function calcHotelRefundAmount(checkInDate, totalPrice) {
    const checkIn = new Date(checkInDate);
    const today = new Date();
    checkIn.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((checkIn - today) / (1000 * 60 * 60 * 24));

    let refundRate, deductionRate, rule;
    if (diffDays >= 5) {
        refundRate = 1.0; deductionRate = 0.0;
        rule = `入住前${diffDays}天-免费取消`;
    } else if (diffDays === 4) {
        refundRate = 0.7; deductionRate = 0.3;
        rule = '入住前4天-扣30%';
    } else if (diffDays === 3) {
        refundRate = 0.5; deductionRate = 0.5;
        rule = '入住前3天-扣50%';
    } else if (diffDays === 2) {
        refundRate = 0.2; deductionRate = 0.8;
        rule = '入住前2天-扣80%';
    } else {
        return {
            canRefund: false,
            refundRate: 0, deductionRate: 1.0,
            refundAmount: 0, deductionAmount: totalPrice,
            rule: `入住前${diffDays}天-不可退款`
        };
    }

    const refundAmount = Math.round(totalPrice * refundRate * 100) / 100;
    const deductionAmount = Math.round(totalPrice * deductionRate * 100) / 100;
    return { canRefund: true, refundRate, deductionRate, refundAmount, deductionAmount, rule };
}

/**
 * 票务退款后恢复库存
 */
const restoreTicketStock = async (order, orderNumber) => {

    try {
        await redisService.incrFun(`ticket:stock:${order.goodsId}`, order.buyNum);
        console.log(`[Refund] Redis 库存已恢复: ${order.goodsId} +${order.buyNum}`);

        const ticket = await Ticket.findOne({ where: { id: order.goodsId } });
        if (ticket) {
            await Ticket.update(
                { remainingStock: ticket.remainingStock + parseInt(order.buyNum) },
                { where: { id: order.goodsId } }
            );
            console.log(`[Refund] 数据库库存已恢复: ${order.goodsId} +${order.buyNum}`);
        }

        const purchaseKey = `purchase:${order.memberId}:${order.goodsId}`;
        await redisService.delFun(purchaseKey);
        console.log(`[Refund] 购买记录已删除: ${purchaseKey}`);

        if (order.seat) {
            await ticketPurchaseService.releaseAllSeats({
                ticketId: order.goodsId,
                userId: order.memberId
            });
            console.log(`[Refund] 选座订单座位已释放: ${orderNumber}`);
        }
    } catch (error) {
        console.error("[Refund] 票务库存恢复失败:", error);
    }
};

/**
 * 套餐退款后恢复库存
 */
const restorePackageStock = async (order, orderNumber) => {

    try {
        const cancelData = await redisService.getFun(`cancel:data:${orderNumber}`, false);
        if (cancelData && cancelData.packageItemId && cancelData.roomTypeId && cancelData.dateRange) {
            for (const date of cancelData.dateRange) {
                const stockKeys = [
                    `combo:stock:${cancelData.packageItemId}:${date}`,
                    `hotel:roomtype:stock:${cancelData.roomTypeId}:${date}`
                ];
                await comboPurchaseService.refundStock(stockKeys, order.buyNum);
                console.log(`[Refund] 套餐库存已恢复: ${date} +${order.buyNum}`);
            }
        } else {
            console.warn(`[Refund] 未找到套餐取消数据: ${orderNumber}，无法恢复库存`);
        }
    } catch (error) {
        console.error("[Refund] 套餐库存恢复失败:", error);
    }
};

/**
 * 酒店退款后恢复库存（按入住晚数恢复）
 */
const restoreHotelStock = async (order, orderNumber) => {

    try {
        // 1. 恢复 Redis 库存（按每晚 roomTypeId:date key）
        await hotelPurchaseService.refundHotel({
            roomPackageId: order.roomId,
            roomTypeId: order.roomTypeId,
            quantity: order.roomCount,
            checkIn: order.checkInDate,
            checkOut: order.checkOutDate
        });
        console.log(`[Refund] 酒店 Redis 库存已恢复: 房型${order.roomTypeId} +${order.roomCount}`);

        // 2. 同步 DB 房型库存（soldStock 减少，availableStock 增加）
        const nights = generateNights(order.checkInDate, order.checkOutDate);
        for (const date of nights) {
            await RoomInventory.increment(
                { availableStock: order.roomCount, soldStock: -order.roomCount },
                { where: { roomTypeId: order.roomTypeId, date: date } }
            );
        }
        console.log(`[Refund] 酒店 DB 库存已恢复: ${nights.join(', ')} +${order.roomCount}`);
    } catch (error) {
        console.error("[Refund] 酒店库存恢复失败:", error);
    }
};

/**
 * 停车场退款后释放车位时段
 * 车位可用性由"时段重叠判断"实现，无需回补 Parking.availableCount 计数器；
 * 退款时 updateRefunded 已将预约单 payStatus 置为已退款(4)，时段自动释放
 */
const restoreParkingStock = async (order, orderNumber) => {
    try {
        await redisService.delFun(`parking:pay:expire:${orderNumber}`).catch(() => { });

        console.log(`[Refund] 停车场车位时段已释放（预约单已取消）: parkingId=${order.parkingId}, spotId=${order.spotId}`);
    } catch (error) {
        console.error("[Refund] 停车场车位时段释放失败:", error);
    }
};


// ============================================================
//  退款处理器注册表（策略模式）
//  新增业务只需要在这里加一项配置，无需修改 refund 主体逻辑
// ============================================================
const refundHandlers = {
    // 票务订单
    ticket: {
        orderType: 1,
        model: Order,
        statusField: 'payStatus',            // 状态字段名
        refundableStatuses: [2, 3],          // 可退款状态：已支付/已完成
        amountField: 'orderAmount',
        // 计算退款金额（票务：全额退）
        calcRefund: (order, { forceRefund, reason }) => ({
            refundAmount: order.orderAmount,
            deductionAmount: 0,
            refundRuleDesc: '',
            isForceRefundFlag: false,
        }),
        // 更新订单状态为已退款（payStatus=4，履约状态不再单独标记）
        updateRefunded: (orderNumber, refundAmount, transaction) => Order.update({
            payStatus: 4,
            refundAmount,
        }, { where: { orderNumber }, transaction }),
        // 恢复库存
        restoreStock: restoreTicketStock,
        // 退款记录附加字段
        getRefundRecordExtras: (order) => ({
            ticketId: order.goodsId,
            ticketName: order.title,
        }),
    },

    // 套餐订单
    package: {
        orderType: 2,
        model: PackageOrderDetail,
        statusField: 'payStatus',
        refundableStatuses: [2, 3],
        amountField: 'orderAmount',
        calcRefund: (order) => ({
            refundAmount: order.orderAmount,
            deductionAmount: 0,
            refundRuleDesc: '',
            isForceRefundFlag: false,
        }),
        updateRefunded: (orderNumber, refundAmount, transaction) => PackageOrderDetail.update({
            payStatus: 4,
            refundAmount,
        }, { where: { orderNumber }, transaction }),
        // 恢复库存 
        restoreStock: restorePackageStock,
        getRefundRecordExtras: (order) => ({
            ticketId: null,
            ticketName: order.itemName || '套餐订单',
        }),
    },

    // 酒店订单（含阶梯退款规则）
    hotel: {
        orderType: 3,
        model: HotelOrder,
        statusField: 'payStatus',
        refundableStatuses: [2, 3],
        amountField: 'totalPrice',
        // 酒店退款：支持强制退款 + 阶梯扣款
        calcRefund: (order, { forceRefund, reason }) => {
            if (forceRefund) {
                return {
                    refundAmount: order.totalPrice,
                    deductionAmount: 0,
                    refundRuleDesc: reason ? `强制退款-投诉:${reason}` : '强制退款-投诉',
                    isForceRefundFlag: true,
                };
            }
            const calc = calcHotelRefundAmount(order.checkInDate, order.totalPrice);
            return {
                refundAmount: calc.refundAmount,
                deductionAmount: calc.deductionAmount,
                refundRuleDesc: calc.rule,
                isForceRefundFlag: false,
                canRefund: calc.canRefund,    // 酒店订单可能不可退款
                rule: calc.rule,
            };
        },
        updateRefunded: (orderNumber, refundAmount, transaction) => HotelOrder.update({
            payStatus: 4,
            refundAmount,
        }, { where: { orderNumber }, transaction }),
        restoreStock: restoreHotelStock,
        getRefundRecordExtras: (order) => ({
            ticketId: order.roomId,
            ticketName: order.title,
        }),
    },

    // 停车预约
    parking: {
        orderType: 4,
        model: ParkingReservation,
        statusField: 'payStatus',
        refundableStatuses: [3], // 可退状态：已完成（停车支付成功即核销完成，仅管理员可强制退款）
        amountField: 'orderAmount', // 退款金额字段名
        calcRefund: (order) => ({ // 计算退款金额（停车：全额退）
            refundAmount: order.orderAmount,
            deductionAmount: 0,
            refundRuleDesc: '',
            isForceRefundFlag: false,
        }),
        // 退款：payStatus 置为已退款(4)，时段自动释放（车位占位判断为 payStatus notIn [4,5]）
        updateRefunded: (orderNumber, refundAmount, transaction) => ParkingReservation.update({
            payStatus: 4,
            cancelReason: '管理员强制退款',
        }, { where: { orderNumber }, transaction }),
        //释放车位时段（预约单取消后时段自动可用）
        restoreStock: restoreParkingStock,
        getRefundRecordExtras: (order) => ({
            ticketId: order.parkingId,
            ticketName: order.title,
        }),
    },

    // 夏令预约
    // summerCamp: {
    //     orderType: 5,
    //     ...
    // },



};


// ============================================================
//  支付宝退款（统一入口，策略模式分发各业务）
// ============================================================
/**
 * 退款流程：
 *   1. 参数校验
 *   2. 验证操作者身份（用户或管理员）
 *   3. 遍历 refundHandlers 注册表查找订单（自动适配各业务表）
 *   4. 检查订单状态
 *   5. 计算退款金额（业务特定，通过 handler.calcRefund）
 *   6. 调用支付宝退款（统一走 paymentService）
 *   7. 更新订单状态（业务特定，通过 handler.updateRefunded）
 *   8. 创建退款记录（统一处理）
 *   9. 提交事务
 *   10. 异步恢复库存（业务特定，通过 handler.restoreStock）
 */
exports.refund = async (req, res) => {
    // 开启事务
    const transaction = await sequelize.transaction();

    try {

        /**
         * @param {string} orderNumber - 订单号
         * @param {number} userID - 用户ID（可选）
         * @param {number} adminId - 管理员ID（可选）
         * @param {boolean} forceRefund - 是否强制退款
         * @param {string} reason - 投诉原因（可选）
         * @returns {Promise<void>} - 退款成功
         */

        const { orderNumber, userID, adminId, forceRefund, reason } = req.body;

        // 1. 参数校验
        if (!orderNumber) {
            return res.json(util.fail("订单号不能为空"));
        }

        // 2. 验证用户/管理员（至少需要一个）
        let operatorName = "";
        if (userID) {
            const userInfo = await Member.findOne({ where: { id: userID } });
            if (!userInfo) {
                return res.json(util.fail("用户不存在"));
            }
            operatorName = userInfo.name || userInfo.phone;
        } else if (adminId) {
            const adminInfo = await User.findOne({ where: { id: adminId } });
            if (!adminInfo) {
                return res.json(util.fail("管理员不存在"));
            }
            operatorName = adminInfo.name || adminInfo.username;
        }

        // 3. 遍历注册表查找订单（自动适配各业务表）
        let matchedHandler = null; // 匹配到的处理函数
        let order = null; // 匹配到的订单
        for (const [type, handler] of Object.entries(refundHandlers)) {
            order = await handler.model.findOne({ where: { orderNumber }, transaction });
            if (order) {
                matchedHandler = handler;
                console.log(`[Refund] 匹配到订单类型: ${type} (orderType=${handler.orderType})`);
                break;
            }
        }

        if (!order) {
            await transaction.rollback();
            return res.json(util.fail("订单不存在"));
        }

        // 4. 检查订单状态
        const currentStatus = order[matchedHandler.statusField];
        if (!matchedHandler.refundableStatuses.includes(currentStatus)) {
            await transaction.rollback();
            return res.json(util.fail("当前订单状态不可退款"));
        }

        // 5. 计算退款金额（业务特定）
        const refundCalc = matchedHandler.calcRefund(order, { forceRefund, reason });

        // 酒店等业务可能返回 canRefund=false
        if (refundCalc.canRefund === false) {
            // 退款失败，回滚事务
            await transaction.rollback();
            return res.json(util.fail(`当前不可退款（${refundCalc.rule}）。如需退款可使用强制退款`));
        }

        const { refundAmount, deductionAmount, refundRuleDesc, isForceRefundFlag } = refundCalc;

        // 6. 生成退款单号 + 调支付宝退款（统一走 paymentService）
        const refundNo = await util.generateOrderNo('RFD');
        const refundResult = await paymentService.refund({
            outTradeNo: order.orderNumber,
            tradeNo: order.tradeNo || order.alipayTradeNo, // 停车预约字段为 tradeNo，其他业务为 alipayTradeNo
            refundAmount,
            refundReason: refundRuleDesc || "正常退款",
            outRequestNo: refundNo,
        });

        console.log("[Refund] 支付宝退款结果:", refundResult);

        // 7. 支付宝退款失败
        if (refundResult.code !== '10000') {
            await transaction.rollback();
            console.error("[Refund] 支付宝退款失败:", refundResult);
            return res.json(util.fail("退款失败", refundResult));
        }

        // 8. 更新订单状态（业务特定）
        await matchedHandler.updateRefunded(orderNumber, refundAmount, transaction);

        // 9. 创建退款记录（统一处理）
        const extras = matchedHandler.getRefundRecordExtras(order);
        const refundReasonText = refundRuleDesc
            ? `${userID ? '用户申请' : '后台操作'}退款-${refundRuleDesc}`
            : (userID ? "用户申请退款" : "后台操作退款");

        await RefundOrder.create({
            refundNo: refundResult.tradeNo,
            orderNo: order.orderNumber,
            userPhone: order.userPhone || order.phone, // 停车预约字段为 phone，其他业务为 userPhone
            refundAmount,
            refundReason: refundReasonText,
            ...extras,
            refundStatus: refundResult.fundChange === "Y" ? 1 : 2,
            auditorName: operatorName,
            refundType: isForceRefundFlag ? 2 : 1,
            orderType: matchedHandler.orderType,
            auditTime: userID ? null : new Date(),
        }, { transaction });

        // 10. 提交事务
        await transaction.commit();

        // 11. 异步恢复库存（业务特定，失败不影响退款结果）
        matchedHandler.restoreStock(order, orderNumber).catch(error => {
            console.error(`[Refund] orderType=${matchedHandler.orderType} 库存恢复失败（不影响退款）:`, error);
        });

        console.log("[Refund] 退款成功:", refundResult);
        return res.json(util.success("退款成功", {
            orderNumber: orderNumber,
            refundNo: refundResult.tradeNo,
            refundAmount,
            deductionAmount,
            refundRule: refundRuleDesc || null,
            isForceRefund: isForceRefundFlag,
            restoredStock: order.buyNum || order.roomCount,
        }));

    } catch (error) {
        await transaction.rollback().catch(() => { });
        console.error("[Refund] 退款失败:", error);
        return res.json(util.fail("退款失败", error.message));
    }
};


// ============================================================
//  公共图片操作（所有业务共用）
// ============================================================
// 上传图片
exports.uploadImg = async (req, res) => {

    const category = req.query.category || 'common'; // 默认为common
    if (!allowedCategory(category)) {
        return res.json(util.fail('非法的上传分类'));
    }

    try {
        singleFileUpload(req, res, async function (error) {
            if (error) {
                return res.json(util.fail(error));
            }
            if (!req.file) {
                return res.json(util.fail("请选择要上传的文件。"));
            }
            try {
                const { path, filename } = req.file;
                let imgRoute = {
                    imgRoute: path + "/" + filename,
                    file: req.file,
                };
                return res.json(util.success("上传文件信息成功", imgRoute));
            } catch (dbError) {
                return res.json(util.fail("上传文件信息失败"));
            }
        });
    } catch (error) {
        return res.json(util.fail(error));
    }
};

// 小程序图片上传（上传至阿里云 OSS，返回完整可访问 URL）
exports.uploadWxImg = async (req, res) => {

    const category = req.query.category || 'common'; // 默认为common
    if (!allowedCategory(category)) {
        return res.json(util.fail('非法的上传分类'));
    }

    try {
        singleFileUpload(req, res, async function (error) {
            if (error) {
                return res.json(util.fail(error.message || error));
            }
            if (!req.file) {
                return res.json(util.fail("请选择要上传的文件。"));
            }
            try {
                // multer-aliyun-oss 返回的 req.file.url 为 OSS 完整访问地址
                const { url, path, filename } = req.file;
                return res.json(util.success("上传文件信息成功", {
                    imgUrl: url,                      // 完整 URL，小程序直接使用
                    imgRoute: path + "/" + filename,  // OSS 相对路径
                    file: req.file,
                }));
            } catch (dbError) {
                return res.json(util.fail("上传文件信息失败"));
            }
        });
    } catch (error) {
        return res.json(util.fail(error.message || error));
    }
};

// 图片目录白名单判断
function allowedCategory(category) {
    // 分类白名单（和 aliyun.js 保持一份，或抽成公共常量）
    const ALLOWED_CATEGORIES = [
        'avatar', // 用户头像
        'ticket', // 票务图片
        'hotel', // 酒店图片
        'package', // 套餐图片
        'parking', // 停车图片
        'camp',  // 露营图片
        'activity', // 活动图片
        'strategy', // 策略图片
        'sport',  // 运动图片
        'relax', // 休闲图片
        'food', // 餐饮图片
        'shopping', // 购物图片
        "bus", // 观光车图片
        'service', // 游客服务图片
        'common'  // 通用图片
    ];
    return ALLOWED_CATEGORIES.includes(category);
}

// 点击删除图片
exports.deleteImg = async (req, res, next) => {
    try {
        const { deleteImageList } = req.body;
        if (!Array.isArray(deleteImageList)) return res.json(util.fail("传递信息有误"));
        let answer = await deleteImage(deleteImageList);
        if (answer.status != 200) return res.json(util.fail("删除失败"));
        return res.json(util.success("", "删除图片"));
    } catch (error) {
        return res.json(util.fail(error));
    }
};





