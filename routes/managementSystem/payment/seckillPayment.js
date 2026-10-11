/*
 * @描述: 万人抢票高并发支付模块
 * @版本: 2.0
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 * 
 * 架构：Redis扣减库存 -> 发送MQ -> 立即返回 -> 异步同步数据库
 */
const express = require('express');
const { Op } = require('sequelize');



const { sequelize } = require("../../../mysql/index");
const redisService = require("../../../services/redisService");
const queueService = require("../../../services/queueService");
const util = require("../../../utils/util");
const { Member, Ticket, Order, CompensationTask, Seat, RefundOrder, PackageOrderDetail } = require("../../../models/Summary");
const { hotelOrderFields } = require("../../../utils/data")
const ticketPurchaseService = require("../../../services/ticketPurchaseService");
const { header } = require('express-validator');

/**
* 高并发抢票 - 创建订单（支持选座）
* 核心优化：只操作Redis，异步同步数据库，5ms内返回
* 
* 流程：
* 1. 参数校验
* 2. 检查用户（缓存）
* 3. 检查重复购买（Redis）
* 4. 扣减Redis库存（原子操作）
* 5. 生成订单号
* 6. 发送订单到MQ
* 7. 立即返回成功（不等待数据库）
*/
exports.createOrder = async (req, res) => {
    const startTime = Date.now();
    const { goodsId, userId, count, seats } = req.body;

    // ========== 1. 参数校验 ==========
    if (!goodsId || !userId || !count) {
        return res.json(util.fail("缺少必要参数！"));
    }

    if (isNaN(count) || !isFinite(count)) {
        return res.json(util.fail("购买数量格式错误！"));
    }

    if (!Number.isInteger(count)) {
        return res.json(util.fail("购买数量必须为整数！"));
    }

    if (count < 0) {
        return res.json(util.fail("购买数量必须大于0！"));
    }

    try {
        // ========== 2. 检查用户（带缓存）==========
        const userCacheKey = `user:${userId}`;
        let user = await redisService.getFun(userCacheKey, true);

        if (!user) {
            user = await Member.findOne({ where: { id: userId } });
            if (!user) {
                return res.json(util.fail("用户不存在"));
            }
            await redisService.setFun(userCacheKey, user, 3600);  //一小时
        }

        // ========== 3. 检查购买数量限制（Redis）==========
        // 从数据库获取商品信息（包括购买限制和库存重置类型）

        const ticketInfo = await Ticket.findOne({
            where: { id: goodsId },
            attributes: ['id', 'remainingStock', 'stock', 'maxPurchaseQuantity', 'stockResetType', 'startTime', 'saleEndDate', 'memberLevel', 'onlineTime', 'saleStartDate', 'isSeat', 'seatId', 'price'] // 只取必要字段 
        });

        if (!ticketInfo) {
            return res.json(util.fail("商品不存在"));
        }

        // 会员等级检查
        if (user.memberLevel < ticketInfo.memberLevel) {
            return res.json(util.fail("会员等级不足，无法购买该商品"));
        }

        // ========== 时间检查 ==========
        const now = new Date()
        // 检查是否已到上线时间
        if (ticketInfo.onlineTime && new Date(ticketInfo.onlineTime) > now) {
            return res.json(util.fail("该商品尚未上线，无法购买"));
        }

        //检查是否在售卖开始时间之后且可购买
        if (ticketInfo.saleStartDate && new Date(ticketInfo.saleStartDate) > now) {
            return res.json(util.fail("该商品售卖尚未开始，无法购买"));
        }

        //检查是否在售卖结束时间之前
        if (ticketInfo.saleEndDate && new Date(ticketInfo.saleEndDate) < now) {
            return res.json(util.fail("该商品售卖已结束，无法购买"));
        }

        const maxPurchaseQuantity = ticketInfo.maxPurchaseQuantity || 0;  // 0表示无限制
        if (maxPurchaseQuantity > 0) {
            // 查询该用户该商品的所有订单购买记录
            const purchaseKeys = await redisService.keys(`purchase:${userId}:${goodsId}:*`);
            let alreadyBuyCount = 0;
            if (purchaseKeys.length > 0) {  //多余判断
                for (const key of purchaseKeys) {
                    const purchaseInfo = await redisService.getFun(key, true);
                    if (purchaseInfo && purchaseInfo.count) {
                        alreadyBuyCount += purchaseInfo.count;
                    }
                }
            }
            // 检查是否超过限制
            if (alreadyBuyCount + count > maxPurchaseQuantity) {
                return res.json(util.fail("超过购买限制", {
                    maxPurchaseQuantity: maxPurchaseQuantity,
                    alreadyBuyCount: alreadyBuyCount,
                    canBuyCount: maxPurchaseQuantity - alreadyBuyCount,
                    message: `该商品限购${maxPurchaseQuantity}张，您已购买${alreadyBuyCount}张，最多还可购买${maxPurchaseQuantity - alreadyBuyCount}张`
                }));
            }
        }

        // ========== 4. 检查并初始化Redis库存 ==========
        const stockKey = `ticket:stock:${goodsId}`;
        let redisStock = await redisService.getFun(stockKey, false);
        // 如果Redis没有库存，从数据库同步（使用remainingStock剩余库存）
        if (!redisStock) {
            console.log(`[Seckill] 初始化Redis库存: goodsId=${goodsId}, remainingStock=${ticketInfo.remainingStock}`);

            // 根据库存重置类型设置不同的缓存时间
            // stockResetType: 0-不重置（预售/总库存模式），1-每日重置（日票模式）
            let expireSeconds;
            if (ticketInfo.stockResetType === 1) {
                // 每日重置：缓存到今晚24点
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setHours(24, 0, 0, 0);
                expireSeconds = Math.floor((tomorrow - now) / 1000);
                console.log(`[Seckill] 日票模式，缓存到今晚24点，剩余${expireSeconds}秒`);
            } else {
                // 预售/总库存模式：缓存1小时
                expireSeconds = 3600;
                console.log(`[Seckill] 预售模式，缓存1小时`);
            }

            await redisService.initializeTicketStock({
                id: goodsId,
                stock: ticketInfo.remainingStock,  // 使用剩余库存
                expire: expireSeconds
            });
        }

        // ========== 5. 生成订单号 ==========
        const orderNo = await util.generateOrderNo('ORDTK');

        // ========== 6. 处理选座 ==========
        let seatData = null;
        if (ticketInfo.isSeat === 2 && seats && seats.length > 0) {
            // 使用选座抢票
            const result = await ticketPurchaseService.purchaseTicketWithSeat({
                ticketId: goodsId,
                userId: userId,
                seats: seats,
                orderNo: orderNo
            });

            if (!result.success) {
                return res.json(util.fail(result.message, { code: result.code }));
            }

            seatData = seats;
        } else {
            // 使用普通抢票
            const result = await ticketPurchaseService.purchaseTicket({
                ticketId: goodsId,
                userId: userId,
                quantity: count,
                orderNo: orderNo
            });

            if (!result.success) {
                return res.json(util.fail(result.message, { code: result.code }));
            }
        }

        // ========== 7. 构建订单数据 ==========
        const orderData = {
            orderNumber: orderNo,
            goodsId: goodsId,
            memberId: userId,
            userName: user.userName,
            userIdCard: user.idCard,
            userPhone: user.phone,
            buyNum: count,
            orderStatus: 1,  // 待支付
            verifyStatus: 1, // 未核销
            createTime: new Date().toISOString(),
            seat: seatData,
            // 预留字段，从Redis或数据库异步获取
            title: null,
            ticketType: null,
            ticketPrice: ticketInfo.price,
            orderAmount: ticketInfo.price * count,
        };

        // ========== 8. 记录购买记录（按订单记录，便于单独退款）==========
        // 根据库存重置类型设置购买记录缓存时间
        // stockResetType: 0-不重置（预售/总库存模式），1-每日重置（日票模式）
        let purchaseExpire;
        if (ticketInfo.stockResetType === 1) {
            // 日票模式：缓存到今晚24点，第二天可以重新购买
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            purchaseExpire = Math.floor((tomorrow - now) / 1000);
        } else {
            // 预售/总库存模式：缓存1小时
            purchaseExpire = 3600;
        }

        // 按订单记录购买记录：purchase:{userId}:{goodsId}:{orderNo}
        const orderPurchaseKey = `purchase:${userId}:${goodsId}:${orderNo}`;
        await redisService.setFun(orderPurchaseKey, {
            userId,
            goodsId,
            orderNo: orderNo,
            count: count,
            buyTime: orderData.createTime
        }, purchaseExpire);

        // ========== 9. 发送订单到消息队列（异步处理，带补偿信息）==========
        await queueService.addOrderJob({
            ...orderData,
            rollbackStock: true,              // 标记需要回滚
            stockKey: `ticket:stock:${goodsId}`,
            count: count,
            purchaseKey: orderPurchaseKey
        });

        // 发送库存同步任务（异步扣减数据库库存）
        await queueService.addStockSyncJob({
            goodsId: goodsId,
            count: count,
            operation: 'decrease',
            orderNo: orderNo,
        });

        // ========== 10. 发送延迟取消任务（10分钟后检查）==========
        await queueService.addCancelJob({
            orderNo: orderNo,
            goodsId: goodsId,
            userId: userId,
            count: count,
            seat: seatData,
            reason: '超时未支付'
        });

        // ========== 11. 立即返回成功（不等待数据库）==========
        const processTime = Date.now() - startTime;
        console.log(`[Seckill] 抢单成功: ${orderNo}, 耗时: ${processTime}ms`);

        res.json(util.success("订单正在处理中，请尽快支付", {
            orderNo: orderNo,
            processTime: processTime,
            expireTimeText: Date.now() + 10 * 60 * 1000
        }));
    } catch (error) {
        console.error("[Seckill] 抢单失败:", error);
        return res.json(util.fail("抢单失败", error.message));
    }
};

/**
 * 获取座位图及实时状态
 */
exports.getSeatMap = async (req, res) => {
    try {
        const { ticketId } = req.params;

        if (!ticketId) {
            return res.json(util.fail("票务ID不能为空"));
        }

        // 获取票务和座位信息
        const ticket = await Ticket.findOne({
            where: { id: ticketId },
            include: [{ model: Seat, as: "seatInfo" }],
        });

        if (!ticket || ticket.isSeat !== 2 || !ticket.seatId) {
            return res.json(util.fail("该票务不需要选座"));
        }

        const seatConfig = ticket.seatInfo;

        // 从 Redis 获取实时座位状态
        let seatStatus = await ticketPurchaseService.getSeatStatus(ticketId);

        // 如果 Redis 中没有，初始化座位状态
        if (!seatStatus) {
            const seatLayout = seatConfig.seats || [];
            await ticketPurchaseService.initializeSeatStatus(ticketId, seatLayout);
            seatStatus = await ticketPurchaseService.getSeatStatus(ticketId);
        }


        // 组装座位图数据
        const layout = (seatConfig.seats || []).map((seat) => {
            const key = `${seat.row}:${seat.col}`;
            const status = seatStatus[key] || { status: 1 };
            const blockedSeats = seatConfig.blockedSeats || [];
            const isBlocked = blockedSeats.some(
                (b) => b.row === seat.row && b.col === seat.col,
            );

            return {
                row: seat.row,
                col: seat.col,
                seatNo: seat.seatNo || `${seat.row}排${seat.col}座`,
                status: isBlocked ? 4 : status.status,
                type: seat.type || "normal",
            };
        });

        return res.json(
            util.success("获取成功", {
                seatMap: {
                    rows: seatConfig.rows,
                    cols: seatConfig.cols,
                    seatName: seatConfig.seatName,
                    layout: layout,
                },
                price: ticket.price,
                maxPurchaseQuantity: ticket.maxPurchaseQuantity,
            }),
        );
    } catch (error) {
        console.error("获取座位图失败:", error);
        return res.json(util.fail("获取失败", error.message));
    }
};

/**
 * 实时锁定座位
 */
exports.lockSeat = async (req, res) => {
    try {
        const { ticketId, row, col, seatNo, userId } = req.body;

        if (!ticketId || !row || !col || !userId) {
            return res.json(util.fail("参数不能为空"));
        }

        const result = await ticketPurchaseService.lockSeat({
            ticketId: ticketId,
            row: row,
            col: col,
            seatNo: seatNo || `${row}排${col}座`,
            userId: userId,
            expireSeconds: 180, // 3分钟
        });

        if (result.success) {
            return res.json(util.success("锁定成功", result));
        } else {
            return res.json(util.fail(result.message, { code: result.code }));
        }
    } catch (error) {
        console.error("锁定座位失败:", error);
        return res.json(util.fail("锁定失败", error.message));
    }
};

/**
 * 取消单个座位锁定
     */
exports.unlockSeat = async (req, res) => {
    try {
        const { ticketId, row, col, userId } = req.body;

        if (!ticketId || !row || !col || !userId) {
            return res.json(util.fail("参数不能为空"));
        }

        const result = await ticketPurchaseService.unlockSeat({
            ticketId: ticketId,
            row: row,
            col: col,
            userId: userId,
        });

        if (result.success) {
            return res.json(util.success("释放成功", result));
        } else {
            return res.json(util.fail(result.message, { code: result.code }));
        }
    } catch (error) {
        console.error("释放座位失败:", error);
        return res.json(util.fail("释放失败", error.message));
    }
};

/**
 * 释放所有座位（换座）
 */
exports.releaseAllSeats = async (req, res) => {
    try {
        const { ticketId, userId } = req.body;

        if (!ticketId || !userId) {
            return res.json(util.fail("参数不能为空"));
        }

        const result = await ticketPurchaseService.releaseAllSeats({
            ticketId: ticketId,
            userId: userId,
        });

        if (result.success) {
            return res.json(util.success("释放成功", result));
        } else {
            return res.json(util.fail(result.message, { code: result.code }));
        }
    } catch (error) {
        console.error("释放座位失败:", error);

        return res.json(util.fail("释放失败", error.message));
    }
};

/**
 * 查询订单
 */
exports.queryOrderList = async (req, res) => {
    try {
        const { outTradeNo, userPhone, userIdCard, startDate, endDate, orderStatus, ticketType } = req.query;
        const pageNum = parseInt(req.query.pageNum) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        let where = {}
        if (ticketType) where.goodsId = ticketType; // 查询票种
        if (orderStatus) where.orderStatus = orderStatus; // 查询订单状态
        if (outTradeNo) where.orderNumber = { [Op.like]: `%${outTradeNo}%` };
        if (userPhone) where.userPhone = { [Op.like]: `%${util.decrypt(userPhone)}%` };
        if (userIdCard) where.userIdCard = { [Op.like]: `%${util.decrypt(userIdCard)}%` };
        // 查询时间范围
        if (startDate || endDate) {
            where.createdAt = {
                [Op.between]: [startDate, endDate],
            };
        }

        let orderList = await Order.findAll({
            where: where,
            order: [['createdAt', 'DESC']],
            offset: (pageNum - 1) * pageSize,
            limit: pageSize,
        });


        orderList.map((order) => {
            order.userPhone = util.encrypt(order.userPhone);
            order.userIdCard = util.encrypt(order.userIdCard);
        })
        let data = {
            orderList: util.formDate(orderList),
            total: await Order.count({ where: where }),
        }
        return res.json(util.success("查询成功", data));


    } catch (error) {
        console.error("查询订单失败:", error);
        return res.json(util.fail("查询失败", error.message));

    }
};
/** 
 * 订单EXCEL导出
 */
exports.exportOrder = async (req, res) => {
    try {
        const { outTradeNo, userPhone, userIdCard, startDate, endDate, orderStatus, ticketType, format = 'xlsx' } = req.body;

        let where = {}
        if (ticketType) where.goodsId = ticketType;
        if (orderStatus) where.orderStatus = orderStatus;
        if (outTradeNo) where.orderNumber = { [Op.like]: `%${outTradeNo}%` };
        if (userPhone) where.userPhone = { [Op.like]: `%${util.decrypt(userPhone)}%` };
        if (userIdCard) where.userIdCard = { [Op.like]: `%${util.decrypt(userIdCard)}%` };
        if (startDate || endDate) {
            where.createdAt = {
                [Op.between]: [startDate, endDate],
            };
        }

        const orders = await Order.findAll({
            where,
            include: [
                {
                    model: Member,
                    as: "member",
                    attributes: ["userName", "phone", "idCard"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });



        // 格式化数据
        const excelData = orders.map(order => ({
            orderNumber: order.orderNumber,
            title: order.title,
            ticketPrice: order.ticketPrice,
            userName: order.userName,
            userPhone: order.userPhone,
            userIdCard: order.userIdCard,
            buyNum: order.buyNum,
            orderStatus: order.orderStatus === 1 ? '待支付' : order.orderStatus === 2 ? '待核销' : order.orderStatus === 3 ? '已取消' : order.orderStatus === 4 ? '已完成' : '已退款',
            verifyStatus: order.verifyStatus === 1 ? '未核销' : order.verifyStatus === 2 ? '已核销' : '已取消',
            orderAmount: order.orderAmount,
            refundAmount: order.refundAmount,
            playDate: order.playDate
        }));

        let data = {
            title: "门票订单详情",
            tabelHeader: [
                { header: "订单号", key: "orderNumber", width: 25 },
                { header: "票务名称", key: "title", width: 20 },
                { header: "票务价格", key: "ticketPrice", width: 12 },
                { header: "用户名", key: "userName", width: 15 },
                { header: "手机号", key: "userPhone", width: 15 },
                { header: "身份证", key: "userIdCard", width: 20 },
                { header: "购买数量", key: "buyNum", width: 12 },
                { header: "订单状态", key: "orderStatus", width: 12 },
                { header: "核销状态", key: "verifyStatus", width: 12 },
                { header: "订单金额", key: "orderAmount", width: 12 },
                { header: "退款金额", key: "refundAmount", width: 12 },
                { header: "游玩日期", key: "playDate", width: 15 }
            ],
            data: excelData
        };

        // 根据格式生成不同文件
        let buffer, contentType, fileExtension, fileName;

        switch (format) {
            case 'csv':
                // 生成CSV格式
                const csvHeader = data.tabelHeader.map(h => h.header).join(',');
                const csvRows = data.data.map(row =>
                    data.tabelHeader.map(h => {
                        const value = row[h.key];
                        // 处理包含逗号或换行符的值
                        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',')
                );
                const csvContent = [csvHeader, ...csvRows].join('\n');
                buffer = Buffer.from('\uFEFF' + csvContent, 'utf-8'); // 添加BOM以支持中文
                contentType = 'text/csv; charset=utf-8';
                fileExtension = 'csv';
                fileName = '门票订单详情.csv';
                break;

            case 'json':
                // 生成JSON格式
                const jsonContent = JSON.stringify(data.data, null, 2);
                buffer = Buffer.from(jsonContent, 'utf-8');
                contentType = 'application/json; charset=utf-8';
                fileExtension = 'json';
                fileName = '门票订单详情.json';
                break;

            case 'xlsx':
            default:
                // 生成Excel格式（默认）
                const result = await util.excelFile(data);
                buffer = result.buffer;
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileExtension = 'xlsx';
                fileName = '门票订单详情.xlsx';
                break;
        }

        // 返回文件
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(fileName));
        res.end(buffer);

    } catch (error) {
        console.error('导出订单失败:', error);
        return res.json(util.fail("获取订单列表失败", error.message));

    }
}

/**
 * 获取队列状态（监控用）
     */
exports.getQueueStatus = async (req, res) => {
    try {
        const status = await queueService.getQueueStatus();
        res.json(util.success("队列状态", status));
    } catch (error) {
        console.error("获取队列状态失败:", error);
        return res.json(util.fail("获取失败", error.message));
    }
};

/**
    * 预热库存（活动开始前调用）
 * 将数据库库存加载到Redis
 */
exports.warmupStock = async (req, res) => {
    try {
        const { goodsId } = req.body;


        if (!goodsId) {
            // 预热所有商品
            const tickets = await Ticket.findAll({
                attributes: ['id', 'remainingStock', 'title']
            });

            for (const ticket of tickets) {
                await redisService.initializeTicketStock({
                    id: ticket.id,
                    stock: ticket.remainingStock
                });
                console.log(`[Warmup] 商品${ticket.id}库存已预热: ${ticket.remainingStock}`);
            }

            return res.json(util.success("库存预热完成", {
                count: tickets.length
            }));

        } else {
            // 预热指定商品
            const ticket = await Ticket.findOne({
                where: { id: goodsId },
                attributes: ['id', 'remainingStock', 'title']
            });

            if (!ticket) {
                return res.json(util.fail("商品不存在"));
            }

            await redisService.initializeTicketStock({
                id: ticket.id,
                stock: ticket.remainingStock
            });

            return res.json(util.success("库存预热完成", {
                goodsId: ticket.id,
                stock: ticket.remainingStock,
                title: ticket.title
            }));
        }

    } catch (error) {
        console.error("库存预热失败:", error);
        return res.json(util.fail("预热失败", error.message));
    }
};

/**
 * 获取实时库存（从Redis读取）
 */
exports.getRealTimeStock = async (req, res) => {
    try {
        const { goodsId } = req.params;

        if (!goodsId) {
            return res.json(util.fail("商品ID不能为空"));
        }

        // 从Redis读取实时库存
        const stockKey = `ticket:stock:${goodsId}`;
        const redisStock = await redisService.getFun(stockKey, false);

        // 从数据库读取库存信息
        const ticket = await Ticket.findOne({
            where: { id: goodsId },
            attributes: ['id', 'stock', 'remainingStock', 'soldCount', 'title']
        });

        if (!ticket) {
            return res.json(util.fail("商品不存在"));
        }

        res.json(util.success("实时库存", {
            goodsId: ticket.id,
            title: ticket.title,
            totalStock: ticket.stock,                    // 总库存（不变）
            remainingStock: ticket.remainingStock,       // 剩余库存
            soldCount: ticket.soldCount,                 // 已售数量
            redisStock: parseInt(redisStock || 0),       // Redis实时库存
        }));

    } catch (error) {
        console.error("获取库存失败:", error);
        return res.json(util.fail("获取失败", error.message));
    }
};

/**
 * 退款订单列表（payment/notify/refund 三个接口已迁移到 publicInterface/index.js）
 */
exports.refundList = async (req, res) => {
    try {
        const { pageNum = 1, pageSize = 10, orderNo, userPhone, orderType } = req.query;

        let where = {}
        if (orderNo) where.orderNo = { [Op.like]: `%${orderNo}%` }

        if (userPhone) where.userPhone = { [Op.like]: `%${userPhone}%` }

        // 支持按订单类型筛选：1-票务,2-套餐,3-酒店
        if (orderType) where.orderType = parseInt(orderType)


        let { rows, count } = await RefundOrder.findAndCountAll({
            where,
            offset: (Number(pageNum) - 1) * Number(pageSize),
            limit: Number(pageSize),
            order: [['createdAt', 'DESC']]
        })

        console.log("[Refund List] 获取退款订单列表成功:", rows, count);

        return res.json(util.success("查询成功", {
            refundList: util.formDate(rows),
            total: count,
        }));

    } catch (error) {
        console.error("[Refund List] 获取退款订单列表失败:", error);
        return res.json(util.fail("获取退款订单列表失败", error.message));
    }
}

/**
 * 处理订单取消（带补偿机制）
 * 注意：退款相关逻辑（payment/notify/refund 及库存恢复函数）已迁移到
 *       routes/managementSystem/publicInterface/index.js
 */
exports.handleOrderCancel = async (orderNo, cancelReason) => {
    const transaction = await sequelize.transaction();

    try {
        let order = await Order.findOne({
            where: { orderNumber: orderNo },
            transaction,
        });

        let isPackageOrder = false;
        if (!order) {
            order = await PackageOrderDetail.findOne({
                where: { orderNumber: orderNo },
                transaction,
            });
            isPackageOrder = !!order;
        }

        if (!order || order.orderStatus !== 1) {
            await transaction.rollback();
            return { success: false, message: "订单状态不允许取消" };
        }

        if (isPackageOrder) {
            await PackageOrderDetail.update(
                { orderStatus: 3, verifyStatus: 3 },
                { where: { orderNumber: orderNo }, transaction },
            );
        } else {
            await Order.update(
                { orderStatus: 3, verifyStatus: 3 },
                { where: { orderNumber: orderNo }, transaction },
            );

            // 旧数据 goodsId 可能为 NULL（早期下单路径未写入），无票务ID无法定位库存/座位，跳过回补只取消订单
            // 注意：脏数据 seat='0'（字符串"0"为真值）表示无座位订单，需排除
            const hasSeat = order.seat && order.seat !== '0';

            if (order.goodsId) {
                await redisService.incrFun(`ticket:stock:${order.goodsId}`, order.buyNum);

                if (hasSeat) {
                    await CompensationTask.create({
                        type: "seat_release",
                        orderNo: orderNo,
                        ticketId: order.goodsId,
                        userId: order.memberId,
                        seats: order.seat,
                        status: "pending",
                        retryCount: 0,
                        maxRetry: 5,
                        expireTime: new Date(Date.now() + 10 * 60 * 1000),
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        if (!isPackageOrder && order.goodsId && order.seat && order.seat !== '0') {
            await ticketPurchaseService.releaseAllSeats({
                ticketId: order.goodsId,
                userId: order.memberId
            });
        }

        return { success: true };
    } catch (error) {
        await transaction.rollback();
        console.error("[Cancel] 处理订单取消失败:", error);
        throw error;
    }
};

/**
 * 每日零点重置库存（根据配置）
 * 由定时任务调用
 */
exports.dailyReset = async () => {
    try {
        console.log("[DailyReset] 开始每日库存重置检查...");

        // 1. 只查询需要每天重置的票务（stockResetType = 1）
        const ticketsToReset = await Ticket.findAll({
            where: { stockResetType: 1 },
            attributes: ["id", "stock", "remainingStock"],
        });

        if (ticketsToReset.length === 0) {
            console.log("[DailyReset] 没有需要重置的票务");
            return { success: true, message: "没有需要重置的票务" };
        }

        console.log(`[DailyReset] 需要重置${ticketsToReset.length}个票务`);

        // 2. 清除这些票务的 Redis 库存缓存
        for (const ticket of ticketsToReset) {
            await redisService.delFun(`ticket:stock:${ticket.id}`);
        }
        console.log(`[DailyReset] 已清除库存缓存`);

        // 3. 清除购买记录（让用户第二天可以重新购买）
        for (const ticket of ticketsToReset) {
            const purchaseKeys = await redisService.keys(`purchase:*:${ticket.id}`);
            for (const key of purchaseKeys) {
                await redisService.delFun(String(key));
            }
        }
        console.log(`[DailyReset] 已清除购买记录`);

        // 4. 恢复剩余库存 = 总库存
        for (const ticket of ticketsToReset) {
            await Ticket.update(
                { remainingStock: ticket.stock },
                { where: { id: ticket.id } },
            );
        }
        console.log(`[DailyReset] 已恢复所有票务库存`);

        console.log("[DailyReset] 每日重置完成");
        return {
            success: true,
            message: "每日重置完成",
            resetCount: ticketsToReset.length,
        };
    } catch (error) {
        console.error("[DailyReset] 重置失败:", error);
        return { success: false, message: error.message };
    }
};

/**
 * HTTP接口：手动触发每日重置
 */
exports.dailyResetAPI = async (req, res) => {
    const result = await exports.dailyReset();
    if (result.success) {
        return res.json(util.success(result.message, result));
    } else {
        return res.json(util.fail(result.message, result));
    }
};