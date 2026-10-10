const { Op } = require('sequelize');
const util = require("../../../utils/util");

// 引入服务
const { sequelize } = require("../../../mysql/index");
const redisService = require("../../../services/redisService");

// 引入模型
const { campOrders, CampSession, Campsite, TicketType, Member } = require("../../../models/Summary")

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

// 列表获取
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



/**
 * @description: 夏令营预约
 * @param {*} req 
 * @param {*} res 
 * @returns {Promise<void>}
 * @param {number} campsiteId - 夏令营ID
 * @param {number} userId - 用户ID
 * @param {string} phone - 手机号
 * @param {string} idCard - 身份证号
 * .......
 * 
 */

// 购买夏令营套餐
exports.campsiteAppointment = async (req, res) => {
    try {
        let { campsiteId, userId, phone, parentPhone, parentIdCard, idCard, sessionId, TicketId } = req.body

        if (!campsiteId || !userId || !phone || !idCard) {
            return res.json(util.fail("缺少必须要参数"))
        }

        let user = await Member.findByPk(userId);
        if (!user) return res.json(util.fail('用户不存在'));

        let existing = await TicketType.findOne({
            where: {
                id: TicketId
            }
        })

        if (!existing) return res.json(util.fail('当前商品不存在'));

        if (existing.sellableCount <= 0) return res.json(util.fail('可预约车位为0'));


        // 分布式锁 防止超卖
        const lockKey = `campsite:lock:${TicketId}`;

        const lockValue = await redisService.acquireLockWithRetry(lockKey, 10, 1000);
        if (!lockValue) return res.json(util.fail("当前预约人数过多，请稍后再试"));


        const t = await sequelize.transaction(); // 开启事务


        try {
            // 创建订单
            let ticket = await TicketType.findByPk(TicketId, { transaction: t });

            if (!ticket) {
                await t.rollback();
                return res.json(util.fail("商品不存在"));
            }

            if (ticket.sellableCount <= 0) {
                await t.rollback();
                return res.json(util.fail("商品已售罄"));
            }

            const [updated] = await TicketType.update(
                {
                    sellableCount: ticket.sellableCount - 1, // 可预约库存减1
                    soldCount: ticket.soldCount + 1,
                },
                {
                    where: {
                        id: TicketId, availableCount: { [Op.gt]: 0, },
                        transaction: t, // 事务 确保在同一事物内操作
                    }
                }
            )
            if (!updated) {
                await t.rollback(); // 回滚事务
                return res.json(util.fail("预约失败,库存不足"));
            }

            // 7. 解密敏感信息
            const decryptedData = {
                idCard: idCard ? util.decrypt(idCard) : null,
                phone: phone ? util.decrypt(phone) : null,
                parentPhone: parentPhone ? util.decrypt(parentPhone) : null,
                parentIdCard: parentIdCard ? util.decrypt(parentIdCard) : null,
            };

            // 生成订单号
            let orderNo = await util.generateOrderNo("ORDPK");

            // 创建订单
            const order = await campOrders.create({
                orderNumber: orderNo,
                userId,
                campsiteId,
                ticketId: TicketId,
                sessionId,
                ...decryptedData,
                status: 1, // 待支付
            }, { transaction });

            await t.commit(); // 提交事务，确保数据一致性

            // 支付标记（10分钟）
            await redisService.setFun(`campsite:pay:expire:${orderNo}`, 1, 10 * 60);


            return res.json(util.success("预约单已创建，请尽快支付"));

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



