const { Op } = require('sequelize');
const util = require("../../../utils/util");

// 引入服务
const { sequelize } = require("../../../mysql/index");
const redisService = require("../../../services/redisService");

// 引入模型
const { ScenicBus, ScenicBusOrder, ScenicBusOrderTicket } = require("../../../models/Summary")

// 状态常量（与模型 comment 保持一致）
// 订单 orderStatus: 1待支付 2待使用 3已完成 4已取消 5已退款
// 支付 payStatus:   1待支付 2已支付 3已退款
// 车票 verifyStatus: 1待乘车 2已核销 3已过期 4已退票

/**
 * 生成不重复的核销码（一票一码，批量）
 * @param {number} count - 需要生成的数量
 * @param {Object} t - 事务实例
 * @returns {Promise<string[]>} 核销码数组
 */
async function generateUniqueVerifyCodes(count, t) {
    let codes = [];
    while (codes.length < count) {
        // 批量生成候选码（码池 SPOP 弹出，天然不重复），必须 await，否则 batch 装的是 Promise
        const batch = await util.generateWriteOffCode(count - codes.length);
        // 查库排除已占用的核销码
        let existing = await ScenicBusOrderTicket.findAll({
            where: { verifyCode: batch },
            attributes: ['verifyCode'],
            transaction: t
        });
        let existingSet = new Set(existing.map(e => e.verifyCode));
        for (let code of batch) {
            if (!existingSet.has(code) && !codes.includes(code)) codes.push(code);
        }
    }
    return codes;
}

/**
 * 统计商品已占库存的票数（已退票不占库存）
 * 口径：有效订单（1待支付/2待使用/3已完成）内，非"已退票"状态的车票数
 * @param {number} scenicBusId - 商品ID
 * @param {Object} t - 事务实例
 * @returns {Promise<number>} 已占库存票数
 */
async function countSoldTickets(scenicBusId, t) {
    return await ScenicBusOrderTicket.count({
        include: [{
            model: ScenicBusOrder,
            as: 'order',
            attributes: [],
            where: {
                scenicBusId: scenicBusId,
                orderStatus: { [Op.in]: [1, 2, 3] }
            }
        }],
        where: { verifyStatus: { [Op.ne]: 4 } },
        transaction: t
    });
}

/**
 * 票明细变更后同步订单状态（核销/退票后调用，需在事务内）
 * 规则：
 *  - 仍有"待乘车"票 → 订单保持 2待使用
 *  - 无"待乘车"票且全部票已退 → 订单 5已退款、payStatus 3
 *  - 无"待乘车"票且存在已核销票 → 订单 3已完成
 * @param {Object} order - 订单实例
 * @param {Object} t - 事务实例
 */
async function syncOrderStatusAfterTicketChange(order, t) {
    const waitingCount = await ScenicBusOrderTicket.count({
        where: { orderId: order.id, verifyStatus: 1 },
        transaction: t
    });
    if (waitingCount > 0) return; // 还有待乘车票，订单状态不动

    const refundedCount = await ScenicBusOrderTicket.count({
        where: { orderId: order.id, verifyStatus: 4 },
        transaction: t
    });

    if (refundedCount >= order.quantity) {
        // 全部票已退 → 已退款
        await ScenicBusOrder.update(
            { orderStatus: 5, payStatus: 3 },
            { where: { id: order.id }, transaction: t }
        );
    } else {
        // 部分核销部分退，无剩余待乘车 → 已完成
        await ScenicBusOrder.update(
            { orderStatus: 3 },
            { where: { id: order.id }, transaction: t }
        );
    }
}

// ==================== 商品管理 ====================

// 景区公交商品操作（action: create/update/delete）
exports.scenicBusOperation = async (req, res) => {
    let { action, id, title } = req.body
    if (!action) return res.json(util.fail("操作类型不能为空"))

    try {
        if (action == "create") {
            let existing = await ScenicBus.findOne({ where: { title } })
            if (existing) return res.json(util.fail("已存在或名称重复"))
            await ScenicBus.create(req.body)
            return res.json(util.success("创建成功"))

        } else if (action == "update") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let status = await ScenicBus.findOne({ where: { id } })
            if (!status) return res.json(util.fail("更新失败,未查询到记录"))
            await ScenicBus.update(req.body, { where: { id } })
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let status = await ScenicBus.findOne({ where: { id } })
            if (!status) return res.json(util.fail("删除失败,未查询到记录"))

            // 已有订单的商品不允许删除，防止历史订单失去关联
            let orderCount = await ScenicBusOrder.count({ where: { scenicBusId: id } })
            if (orderCount > 0) return res.json(util.fail("该商品下存在订单，无法删除，可先下线"))

            await ScenicBus.destroy({ where: { id } })
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

// 商品列表
exports.scenicBusList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title, status, ticketType } = req.query
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }
        if (status) where.status = status
        if (ticketType) where.ticketType = ticketType

        const { count, rows } = await ScenicBus.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['sort', 'ASC'], ['id', 'DESC']],
        })

        return res.json(util.success('获取成功', { scenicBusList: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

// 商品详情
exports.scenicBusDetail = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))
        const scenicBus = await ScenicBus.findOne({ where: { id } })
        if (!scenicBus) return res.json(util.fail("未查询到记录"))
        return res.json(util.success("获取成功", scenicBus))
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// ==================== 购票下单（一单多票、一票一码） ====================

/**
 * @description: 景区公交购票下单
 * @param {number} scenicBusId - 景区公交商品ID
 * @param {number} userId - 用户ID
 * @param {string} userPhone - 联系电话（加密）
 * @param {string} contactName - 联系人姓名（可选）
 * @param {string} rideDate - 乘车日期 YYYY-MM-DD（须在商品售卖日期区间内）
 * @param {number} quantity - 购票数量（1~10）
 * 下单成功后按数量生成车票明细，每张票独立核销码（一票一码）
 */
exports.scenicBusAppointment = async (req, res) => {
    let { scenicBusId, userId, userPhone, contactName, rideDate, quantity } = req.body

    if (!scenicBusId || !userId || !userPhone || !rideDate || !quantity) {
        return res.json(util.fail("缺少必要参数"))
    }
    quantity = parseInt(quantity)
    if (isNaN(quantity) || quantity < 1 || quantity > 10) {
        return res.json(util.fail("购票数量须为1~10"))
    }

    try {
        // 校验商品：存在、已上线
        let bus = await ScenicBus.findOne({ where: { id: scenicBusId, status: 1 } })
        if (!bus) return res.json(util.fail("该班次不存在或已下线"))

        // 校验乘车日期在售卖日期区间内（DATEONLY 均为 YYYY-MM-DD，字符串比较即可）
        if (rideDate < bus.startDate || rideDate > bus.endDate) {
            return res.json(util.fail(`乘车日期须在售卖区间 ${bus.startDate} ~ ${bus.endDate} 内`))
        }

        // 分布式锁（以商品为粒度，防止超卖）
        const lockKey = `scenicBus:lock:${scenicBusId}`;
        const lockValue = await redisService.acquireLockWithRetry(lockKey, 10, 1000);
        if (!lockValue) return res.json(util.fail("当前购票人数过多，请稍后再试"));

        const t = await sequelize.transaction(); // 开启事务

        try {
            // 行锁锁定商品，二次校验上架状态
            let lockedBus = await ScenicBus.findByPk(scenicBusId, {
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!lockedBus || lockedBus.status != 1) {
                await t.rollback();
                return res.json(util.fail("该班次不存在或已下线"));
            }

            // 库存校验：已占库存票数 + 本次购票数 不能超过总放票量
            const soldCount = await countSoldTickets(scenicBusId, t);
            if (soldCount + quantity > lockedBus.totalStock) {
                await t.rollback();
                return res.json(util.fail("余票不足"));
            }

            // 解密联系电话
            const phone = userPhone ? util.decrypt(userPhone) : null;

            // 生成订单号
            const orderNo = await util.generateOrderNo("ORDBUS");

            // 金额以商品当前售价为准（快照）
            const unitPrice = parseFloat(lockedBus.price);
            const totalAmount = unitPrice * quantity;

            // 创建订单
            const order = await ScenicBusOrder.create({
                orderNumber: orderNo,
                userId,
                userPhone: phone,
                contactName: contactName || null,
                scenicBusId,
                title: lockedBus.title,
                image: lockedBus.image,
                ticketType: lockedBus.ticketType,
                rideDate,
                timeSlot: lockedBus.timeSlot,
                quantity,
                totalAmount,
                orderAmount: totalAmount,
                refundAmount: 0,
                payStatus: 1,      // 待支付
                transactionNumber: null,
                paymentTime: null,
                orderStatus: 1,    // 待支付
                cancelReason: null,
            }, { transaction: t });

            // 生成核销码（查重防冲突）与车票号
            const verifyCodes = await generateUniqueVerifyCodes(quantity, t);

            // 批量创建车票明细（一票一码，每张票独立核销/退票）
            await ScenicBusOrderTicket.bulkCreate(
                verifyCodes.map((code, i) => ({
                    orderId: order.id,
                    seq: i + 1,
                    ticketNo: `${orderNo}-${String(i + 1).padStart(2, '0')}`,
                    verifyCode: code,
                    verifyStatus: 1,                       // 待乘车
                    ticketAmount: unitPrice,               // 该票实付金额（退款依据）
                    refundAmount: 0,
                })),
                { transaction: t }
            );

            await t.commit(); // 提交事务，确保订单与车票数据一致

            // 支付标记（10分钟未支付自动释放）
            await redisService.setFun(`scenicBus:pay:expire:${orderNo}`, 1, 10 * 60);

            return res.json(util.success("下单成功，请尽快支付", {
                orderNumber: orderNo,
                orderAmount: totalAmount,
                ticketCount: quantity,
            }));

        } catch (error) {
            if (t && !t.finished) await t.rollback();
            return res.json(util.fail(error.message))
        } finally {
            await redisService.releaseLock(lockKey, lockValue);
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

// ==================== 订单查询 ====================

// 订单列表
exports.scenicBusOrderList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, orderNumber, userId, scenicBusId, orderStatus, rideDate } = req.query
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {}
        if (orderNumber) where.orderNumber = { [Op.like]: `%${orderNumber}%` }
        if (userId) where.userId = userId
        if (scenicBusId) where.scenicBusId = scenicBusId
        if (orderStatus) where.orderStatus = orderStatus
        if (rideDate) where.rideDate = rideDate

        const { count, rows } = await ScenicBusOrder.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['createdAt', 'DESC']],
        })

        return res.json(util.success('获取成功', { scenicBusOrderList: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

// 订单详情（含车票明细：每张票的票号/核销码/核销状态）
exports.scenicBusOrderDetail = async (req, res) => {
    try {
        let { id, orderNumber } = req.query
        if (!id && !orderNumber) return res.json(util.fail("缺少必要参数"))

        let where = {}
        if (id) where.id = id
        if (orderNumber) where.orderNumber = orderNumber

        const order = await ScenicBusOrder.findOne({
            where,
            include: [{
                model: ScenicBusOrderTicket,
                as: 'tickets',
            }],
        })
        if (!order) return res.json(util.fail("未查询到订单"))
        return res.json(util.success("获取成功", order))
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// ==================== 核销与退票 ====================

/**
 * @description: 车票核销（扫单张票码，一票一码互不影响）
 * @param {string} verifyCode - 车票核销码（二维码内容）
 * @param {number} operatorId - 核销操作人ID
 */
exports.scenicBusVerify = async (req, res) => {
    let { verifyCode, operatorId } = req.body
    if (!verifyCode) return res.json(util.fail("核销码不能为空"))

    try {
        const t = await sequelize.transaction();
        try {
            // 查票（含所属订单）
            const ticket = await ScenicBusOrderTicket.findOne({
                where: { verifyCode },
                include: [{ model: ScenicBusOrder, as: 'order' }],
                transaction: t,
            });
            if (!ticket) {
                await t.rollback();
                return res.json(util.fail("核销码无效"));
            }
            const order = ticket.order;

            // 已核销/已退票的票不可重复核销
            if (ticket.verifyStatus == 2) {
                await t.rollback();
                return res.json(util.fail("该票已核销，请勿重复核销"));
            }
            if (ticket.verifyStatus == 4) {
                await t.rollback();
                return res.json(util.fail("该票已退票，不可核销"));
            }

            // 未支付订单不可核销
            if (order.payStatus != 2) {
                await t.rollback();
                return res.json(util.fail(`订单未完成支付（当前支付状态：${order.payStatus}）`));
            }

            // 乘车日期已过 → 置过期并拒绝核销
            const today = new Date().toISOString().slice(0, 10);
            if (order.rideDate < today) {
                await ScenicBusOrderTicket.update(
                    { verifyStatus: 3 },
                    { where: { id: ticket.id }, transaction: t }
                );
                await syncOrderStatusAfterTicketChange(order, t);
                await t.commit();
                return res.json(util.fail("该车票已过期（乘车日期已过）"));
            }

            // 核销当前这张票
            await ScenicBusOrderTicket.update(
                { verifyStatus: 2, verifyTime: new Date(), verifiedBy: operatorId || null },
                { where: { id: ticket.id }, transaction: t }
            );

            // 无剩余待乘车票时，订单流转为已完成
            await syncOrderStatusAfterTicketChange(order, t);

            await t.commit();

            // 返回剩余待乘车票数（前端可提示"本单还剩X张待乘车"）
            const waitingCount = await ScenicBusOrderTicket.count({
                where: { orderId: order.id, verifyStatus: 1 }
            });
            return res.json(util.success("核销成功", {
                ticketNo: ticket.ticketNo,
                orderNumber: order.orderNumber,
                waitingCount,
            }));

        } catch (error) {
            if (t && !t.finished) await t.rollback();
            return res.json(util.fail(error.message))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

/**
 * @description: 单张车票退票（如用户A已乘车、用户B未乘车，可只退B的票）
 * @param {number} ticketId - 车票ID（与 verifyCode 二选一）
 * @param {string} verifyCode - 车票核销码（与 ticketId 二选一）
 * @param {string} reason - 退票原因（可选）
 */
exports.scenicBusRefund = async (req, res) => {
    let { ticketId, verifyCode, reason } = req.body
    if (!ticketId && !verifyCode) return res.json(util.fail("缺少必要参数"))

    try {
        const t = await sequelize.transaction();
        try {
            let where = {}
            if (ticketId) where.id = ticketId
            if (verifyCode) where.verifyCode = verifyCode

            const ticket = await ScenicBusOrderTicket.findOne({
                where,
                include: [{ model: ScenicBusOrder, as: 'order' }],
                transaction: t,
            });
            if (!ticket) {
                await t.rollback();
                return res.json(util.fail("未查询到该车票"));
            }
            const order = ticket.order;

            // 仅"待乘车"的票可退：已核销的已消费，已退票的不能重复退
            if (ticket.verifyStatus != 1) {
                await t.rollback();
                return res.json(util.fail(`该车票当前状态不可退票（状态：${ticket.verifyStatus}，1:待乘车 2:已核销 3:已过期 4:已退票）`));
            }
            // 未支付订单无退款，直接取消即可
            if (order.payStatus != 2) {
                await t.rollback();
                return res.json(util.fail(`订单未完成支付，无需退票，可直接取消订单`));
            }

            // 该票置为已退票，记录退款金额
            await ScenicBusOrderTicket.update(
                { verifyStatus: 4, refundTime: new Date(), refundAmount: ticket.ticketAmount },
                { where: { id: ticket.id }, transaction: t }
            );

            // 订单累计退款金额
            await ScenicBusOrder.update(
                { refundAmount: Number(order.refundAmount || 0) + Number(ticket.ticketAmount) },
                { where: { id: order.id }, transaction: t }
            );

            // 全部票退完 → 订单已退款；部分退 → 订单状态同步
            await syncOrderStatusAfterTicketChange(order, t);

            await t.commit();

            return res.json(util.success("退票成功，退款将原路退回", {
                ticketNo: ticket.ticketNo,
                orderNumber: order.orderNumber,
                refundAmount: ticket.ticketAmount,
                orderRefundAmount: Number(order.refundAmount || 0) + Number(ticket.ticketAmount),
                reason: reason || null,
            }));

        } catch (error) {
            if (t && !t.finished) await t.rollback();
            return res.json(util.fail(error.message))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}

// ==================== 支付（占位，待接入支付渠道） ====================

/**
 * @description: 景区公交订单支付（接口占位，暂不实现）
 * 实现时的处理流程：
 *  1. 校验订单存在且为"待支付"状态，且未超过10分钟支付时限
 *  2. 按金额调用微信/支付宝统一下单，返回前端拉起支付所需参数
 *  3. 支付回调中更新订单：payStatus=2 已支付、orderStatus=2 待使用、
 *     paymentTime、transactionNumber（第三方交易号）
 *  4. 支付成功后车票方可核销
 * @param {string} orderNumber - 订单编号
 */
exports.scenicBusPay = async (req, res) => {
    // TODO: 待接入微信/支付宝支付渠道
    return res.json(util.fail("支付功能开发中"))
}
