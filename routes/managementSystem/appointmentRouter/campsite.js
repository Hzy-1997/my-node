const { Op } = require('sequelize');
const util = require("../../../utils/util");

// 引入服务
const { sequelize } = require("../../../mysql/index");
const redisService = require("../../../services/redisService");

// 引入模型
const { campOrders, campOrderParticipants, CampSession, Campsite, TicketType, Member } = require("../../../models/Summary")

// 操作夏令营模块
exports.campsiteOperation = async (req, res) => {

    let { action, id, title } = req.body
    if (!action) return res.json(util.fail("操作类型不能为空"))

    try {
        if (action == "create") {
            let existing = await Campsite.findOne({
                where: {
                    title: title,
                }
            })

            console.log("数据情况", existing)

            if (existing) return res.json(util.fail("已存在或名称重复"))
            await Campsite.create(req.body)
            return res.json(util.success("创建成功"))


        } else if (action == "update") {
            if (!id) return res.json(util.fail("缺少必须要参数"))
            let stasus = await Campsite.findOne({
                where: {
                    id: id,
                }
            })
            if (!stasus) return res.json(util.fail("更新失败,未查询到记录"))
            await Campsite.update(req.body, {
                where: {
                    id: id,
                }
            })
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少必须要参数"))
            let stasus = await Campsite.findOne({
                where: {
                    id: id,
                }
            })
            if (!stasus) return res.json(util.fail("删除失败,未查询到记录"))
            await Campsite.destroy({
                where: {
                    id: id,
                }
            })
            return res.json(util.success("删除成功"))
        }

    } catch (error) {

        return res.json(util.fail("系统错误", error.message))

    }

}

// 获取夏令营列表
exports.getCampsiteList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }

        const { count, rows } = await Campsite.findAndCountAll({
            where: where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            include: [{
                model: CampSession,
                as: 'campSessions',
                attributes: ["id", "sessionName"],
            }],
            order: [['sortOrder', 'ASC']],
        }
        );
        return res.json(util.success('获取成功', { campsiteList: util.formDate(rows), count }));
    } catch (error) {

        return res.json(util.fail("系统错误", error.message))
    }
}

// 获取夏令营详情
exports.getCampsiteDetail = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))
        const campsite = await Campsite.findOne({
            include: [{
                model: CampSession,
                as: 'campSessions',
                // attributes: [],
            },
                // {
                //     model: TicketType,
                //     as: 'ticketTypes',
                //     // attributes: [],
                // }
            ],
            where: {
                id: id,
            }
        });
        if (!campsite) return res.json(util.fail("未查询到记录"))
        return res.json(util.success("获取成功", campsite))
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 期数操作
exports.campsiteOperate = async (req, res) => {
    try {
        let { action, id, campId, sessionName } = req.body
        if (!action) return res.json(util.fail("缺少必要参数"))

        if (action == "create") {
            if (!campId) return res.json(util.fail("缺少必要参数"))

            const campsite = await CampSession.findOne({
                where: {
                    sessionName: sessionName,
                }
            });
            if (campsite) return res.json(util.fail("已存在或名称重复"))
            await CampSession.create({
                ...req.body,
            })
            return res.json(util.success("创建成功"))


        } else if (action == "update") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let stasus = await CampSession.findOne({
                where: {
                    id: id,
                }
            })
            if (!stasus) return res.json(util.fail("更新失败,未查询到记录"))
            await CampSession.update(req.body, {
                where: {
                    id: id,
                }
            })
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let stasus = await CampSession.findOne({
                where: {
                    id: id,
                }
            })
            if (!stasus) return res.json(util.fail("删除失败,未查询到记录"))
            await CampSession.destroy({
                where: {
                    id: id,
                }
            })
            return res.json(util.success("删除成功"))
        }


    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 期数列表获取
exports.getCampsiteSessionList = async (req, res) => {
    try {
        let { sessionName, page = 1, pageSize = 10 } = req.query
        page = parseInt(page);
        pageSize = parseInt(pageSize);
        let where = {};
        if (sessionName) where.sessionName = { [Op.like]: `%${sessionName}%` };
        const { count, rows } = await CampSession.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['sortOrder', 'ASC']],
        });

        return res.json(util.success('获取成功', { campsiteSessionList: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 期数详情
exports.getCampsiteSessionDetail = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("id不能为空"))
        let campsiteSession = await CampSession.findOne({
            include: [
                {
                    model: TicketType,
                    as: 'ticketTypes',
                }
            ],
            where: {
                id: id,
            }
        });
        return res.json(util.success('获取成功', campsiteSession));
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 票档操作
exports.ticketTypeOperation = async (req, res) => {
    try {
        let { action, id, campId, sessionId, ticketName, price } = req.body
        if (!action) return res.json(util.fail("操作类型不能为空"))

        if (action == "create") {
            if (!campId || !ticketName || price === undefined) return res.json(util.fail("缺少必要参数"))

            let camp = await Campsite.findByPk(campId)
            if (!camp) return res.json(util.fail("营地不存在"))

            // 票档指定场次时，校验场次归属该营地
            if (sessionId) {
                let session = await CampSession.findByPk(sessionId)
                if (!session || session.campId != campId) return res.json(util.fail("场次不存在或不属于该营地"))
            }

            let existing = await TicketType.findOne({
                where: { campId, sessionId: sessionId || null, ticketName }
            })
            if (existing) return res.json(util.fail("该营地/场次下已存在同名票档"))

            await TicketType.create(req.body)
            return res.json(util.success("创建成功"))

        } else if (action == "update") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let ticket = await TicketType.findByPk(id)
            if (!ticket) return res.json(util.fail("更新失败,未查询到记录"))

            // 校验调整后的场次归属
            let targetCampId = req.body.campId || ticket.campId
            let targetSessionId = req.body.sessionId !== undefined ? req.body.sessionId : ticket.sessionId
            if (targetSessionId) {
                let session = await CampSession.findByPk(targetSessionId)
                if (!session || session.campId != targetCampId) return res.json(util.fail("场次不存在或不属于该营地"))
            }

            await TicketType.update(req.body, {
                where: { id }
            })
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let ticket = await TicketType.findByPk(id)
            if (!ticket) return res.json(util.fail("删除失败,未查询到记录"))

            let orderCount = await campOrders.count({ where: { ticketId: id } })
            if (orderCount > 0) return res.json(util.fail("该票档下存在订单，无法删除"))

            await TicketType.destroy({ where: { id } })
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 票档列表
exports.getCampsiteTicketList = async (req, res) => {
    try {
        let { campId, sessionId, ticketName, page = 1, pageSize = 10 } = { ...req.query, ...req.body }
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {};
        if (campId) where.campId = campId;
        if (sessionId) where.sessionId = sessionId;
        if (ticketName) where.ticketName = { [Op.like]: `%${ticketName}%` };

        const { count, rows } = await TicketType.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            include: [{
                model: CampSession,
                as: 'session',
                attributes: ["id", "sessionName", "startDate", "endDate"],
                required: false,
            }],
            order: [['sortOrder', 'ASC']],
        });

        return res.json(util.success('获取成功', { campsiteTicketList: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}


/**
 * @description: 夏令营预约（创建订单，支持一单多人）
 * @param {number} campsiteId - 营地ID
 * @param {number} sessionId - 场次ID（库存以场次总容量控制）
 * @param {number} ticketId - 票档ID
 * @param {number} userId - 用户ID
 * @param {string} phone - 手机号（加密）
 * @param {string} parentPhone - 家长手机号（加密）
 * @param {string} parentIdCard - 家长身份证号（加密）
 * @param {string} parentName - 家长姓名
 * @param {Array<Object>} participants - 营员信息数组，每个营员一条，字段：
 *          {string} camperName - 营员姓名（必填）
 *          {number} camperGender - 营员性别 1:男 2:女
 *          {number} camperAge - 营员年龄（必填）
 *          {string} idCard - 营员身份证号（加密，必填）
 *          {number} height - 身高
 *          {number} weight - 体重
 *          {string} way - 来营方式
 *          {string} notice - 注意事项
 *          {string} dietaryRestrictions - 饮食禁忌
 * @param {string} remark - 备注
 *
 */
exports.campsiteAppointment = async (req, res) => {
    let {
        campsiteId, sessionId, ticketId, userId,
        userPhone, parentPhone, parentIdCard,
        participants, parentName, remark,
    } = req.body

    if (!campsiteId || !sessionId || !ticketId || !userId || !userPhone) {
        return res.json(util.fail("缺少必要参数"))
    }

    // 校验营员信息：必须传数组，且每个营员必填姓名/年龄/身份证号
    if (!Array.isArray(participants) || participants.length === 0) {
        return res.json(util.fail("请填写营员信息"))
    }
    for (let i = 0; i < participants.length; i++) {
        const p = participants[i]
        if (!p.camperName || !p.camperAge || !p.idCard) {
            return res.json(util.fail(`第${i + 1}位营员信息不完整（姓名/年龄/身份证号为必填）`))
        }
    }

    // 报名人数以营员信息条数为准
    const peopleCount = participants.length

    try {
        let user = await Member.findByPk(userId);
        if (!user) return res.json(util.fail('用户不存在'));

        let campsite = await Campsite.findByPk(campsiteId);
        if (!campsite || campsite.status != 1) return res.json(util.fail('营地不存在或已下架'));

        let session = await CampSession.findOne({
            where: { id: sessionId, campId: campsiteId, status: 1 }
        });
        if (!session) return res.json(util.fail('场次不存在或不可用'));

        let ticket = await TicketType.findOne({
            where: { id: ticketId, status: 1 }
        });
        if (!ticket) return res.json(util.fail('票档不存在或不可用'));
        if (ticket.campId != campsiteId) return res.json(util.fail('票档与营地不匹配'));
        // 票档指定了场次时，必须与所选场次一致
        if (ticket.sessionId && ticket.sessionId != sessionId) {
            return res.json(util.fail('票档与场次不匹配'));
        }

        // 分布式锁（以场次为粒度，防止同期超卖）
        const lockKey = `campsite:lock:session:${sessionId}`;
        const lockValue = await redisService.acquireLockWithRetry(lockKey, 10, 1000);
        if (!lockValue) return res.json(util.fail("当前预约人数过多，请稍后再试"));

        const t = await sequelize.transaction(); // 开启事务

        try {
            // 行锁锁定场次，校验剩余容量（totalInventory 为 0 表示不限）
            let lockedSession = await CampSession.findByPk(sessionId, {
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!lockedSession) {
                await t.rollback();
                return res.json(util.fail("场次不存在"));
            }

            if (lockedSession.totalInventory > 0 && lockedSession.soldCount + peopleCount > lockedSession.totalInventory) {
                await t.rollback();
                return res.json(util.fail("该期名额已满"));
            }

            // 场次已售人数按报名人数累加
            await CampSession.update(
                { soldCount: lockedSession.soldCount + peopleCount },
                { where: { id: sessionId }, transaction: t }
            );

            // 解密敏感信息（订单级：下单人联系方式）
            const decryptedData = {
                userPhone: userPhone ? util.decrypt(userPhone) : 123456789,
                parentPhone: parentPhone ? util.decrypt(parentPhone) : 123456789,
                parentIdCard: parentIdCard ? util.decrypt(parentIdCard) : 123123123,
            };

            // 解密营员身份证号
            const decryptedParticipants = participants.map(p => ({
                ...p,
                idCard: p.idCard ? util.decrypt(p.idCard) : null,
            }));

            // 生成订单号
            let orderNo = await util.generateOrderNo("ORDCAMP");

            // 订单金额以票档价格为准（票档价为该票档总价）
            const totalAmount = parseFloat(ticket.price);

            // 创建订单
            const order = await campOrders.create({
                title: `${campsite.title}-${lockedSession.sessionName}-${ticket.ticketName}`,
                orderNumber: orderNo,
                userId,
                userPhone: userPhone ? util.decrypt(userPhone) : 123456789,
                ticketId,
                campsiteId,
                sessionId,
                startDate: lockedSession.startDate,
                endDate: lockedSession.endDate,
                peopleCount,
                totalAmount,
                discount: 0,
                orderAmount: totalAmount,
                payMethod: 1,
                payStatus: 1, // 待支付（统一五态，订单生命周期由 payStatus 承载）
                cancelReason: null,
                remark,
            }, { transaction: t });

            // 批量创建营员明细（一单多人，每个营员一条记录）
            await campOrderParticipants.bulkCreate(
                decryptedParticipants.map(p => ({
                    orderId: order.id,
                    camperName: p.camperName,
                    camperGender: p.camperGender,
                    camperAge: p.camperAge,
                    idCard: p.idCard,
                    height: p.height,
                    weight: p.weight,
                    way: p.way,
                    notice: p.notice,
                    dietaryRestrictions: p.dietaryRestrictions,
                    ...decryptedData,
                })),
                { transaction: t }
            );

            await t.commit(); // 提交事务，确保数据一致性

            // 支付标记（10分钟）
            await redisService.setFun(`campsite:pay:expire:${orderNo}`, 1, 10 * 60);

            return res.json(util.success("预约单已创建，请尽快支付", { orderNumber: orderNo, orderAmount: totalAmount }));

        } catch (error) {
            if (t && !t.finished) await t.rollback();
            return res.json(util.fail(error.message));
        } finally {
            await redisService.releaseLock(lockKey, lockValue);
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}
