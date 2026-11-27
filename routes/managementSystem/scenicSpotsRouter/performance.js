/*
 * @描述:
 * @版本:
 * @作者:
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const { secretJwt } = require("../../../config/index.js");
const util = require("../../../utils/util.js");
const { Performance, PerformanceSchedule, Reminder } = require("../../../models/Summary.js");



// 演出节目操作（创建/更新/删除）
exports.performance = async (req, res) => {

    const { action } = req.body;

    if (!action) return res.json(util.fail("操作类型不能为空"));

    // 剔除操作字段，避免误写入模型
    const { action: _, ...payload } = req.body;

    try {

        if (action == "create") {
            const { title, coordinates } = req.body;
            if (!title) return res.json(util.fail("名称不能为空"));
            if (!coordinates) return res.json(util.fail("坐标不能为空"));

            let data = await Performance.findOne({
                where: {
                    title
                }
            })
            if (data) return res.json(util.fail("名称已存在"));

            await Performance.create(payload);
            return res.json(util.success("创建成功"));

        } else if (action == "update") {
            const { id, title } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));
            let data = await Performance.findByPk(id);
            if (!data) return res.json(util.fail("演出节目不存在"));

            if (!title) return res.json(util.fail("名称不能为空"));

            // 校验名称唯一时排除自身，避免未改名时误报
            let exist = await Performance.findOne({
                where: {
                    title,
                    id: { [Op.ne]: id }
                }
            })
            if (exist) return res.json(util.fail("名称已存在"));

            const { id: __, ...values } = payload;
            await Performance.update(values, {
                where: {
                    id
                }
            });
            return res.json(util.success("更新成功"));
        } else if (action == "delete") {
            const { id } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));
            let data = await Performance.findByPk(id);
            if (!data) return res.json(util.fail("演出节目不存在"));

            // 级联删除该演出的全部场次
            await PerformanceSchedule.destroy({
                where: {
                    performanceId: id
                }
            });
            await Performance.destroy({
                where: {
                    id
                }
            });

            return res.json(util.success("删除成功"));
        } else {
            return res.json(util.fail("不支持的操作类型"));
        }

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}

// 获取演出节目列表
exports.performanceList = async (req, res) => {
    try {
        let { title, status, performanceTypes, page = 1, pageSize = 10, } = req.query;

        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {};
        if (title) where.title = { [Op.like]: `%${title}%` }; // 演出节目名称（模糊查询）
        if (status) where.status = parseInt(status); // 状态
        if (performanceTypes) where.performanceTypes = parseInt(performanceTypes); // 演出类型

        const { rows, count } = await Performance.findAndCountAll({
            where,
            include: [{
                model: PerformanceSchedule,
                as: "schedules",
                required: false,           // LEFT JOIN，保留没有 schedule 的 Performance
                separate: true,            // 独立查询，彻底避开 JOIN 分页问题
                order: [["weekDay", "ASC"], ["showTime", "ASC"]],  // 子表按星期+时间排序
            }],
            attributes: { exclude: ["createdAt", "updatedAt"] },
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["sort", "ASC"], ["id", "DESC"]],
            distinct: true,              // count 去重（非 separate 时更必要）
            subQuery: false,             // ⭐ separate 模式下建议关闭 subQuery
        });

        return res.json(util.success("获取成功", {
            rows,
            count
        }));

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}

// 获取演出节目详情
exports.performanceDetail = async (req, res) => {
    try {
        const { id, userId } = req.query;
        if (!id) return res.json(util.fail("缺少必要参数"));

        if (!req.headers.authorization) {
            return res.json(util.fail("未登录，请先登录"));
        }

        let token = req.headers.authorization.replace("Bearer ", "");
        if (!token) {
            return res.json(util.fail("登录信息无效，请重新登录"));
        }

        // 捕获 jwt 的验证错误，判断是否是过期的 token
        let userInfo;
        try {
            userInfo = jwt.verify(token, secretJwt.secret);
        } catch (error) {
            return res.json(util.fail("无效的登录信息，请重新登录"));
        }

        // // 关联用户预约记录（传 userId 时只查该用户的预约，便于前端判断有没有预约）
        // if (userId) reminderInclude.where = { userId: parseInt(userId) };

        let data = await Performance.findByPk(id, {
            include: [{
                model: PerformanceSchedule,
                as: "schedules",
                required: false,           // LEFT JOIN，保留没有 schedule 的 Performance
                separate: true,            // 独立查询，彻底避开 JOIN 分页问题
                order: [["weekDay", "ASC"], ["showTime", "ASC"]],  // 子表按星期+时间排序
            }, {
                model: Reminder,
                as: "reminders",             // 对应 associations.js 中 Performance.hasMany(Reminder)
                required: false,              // LEFT JOIN，保留没有预约记录的 Performance
                separate: true,               // 独立查询，避开 JOIN 分页问题
                where: { userId: userInfo.id },  // 只查当前登录用户的预约记录
            }],
            attributes: { exclude: ["createdAt", "updatedAt"] },
            order: [["sort", "ASC"], ["id", "DESC"]],
            distinct: true,              // count 去重（非 separate 时更必要）
            subQuery: false,             // ⭐ separate 模式下建议关闭 subQuery
        });
        if (!data) return res.json(util.fail("演出节目不存在"));
        return res.json(util.success("获取成功", data));
    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}

// 演出场次操作（创建/批量创建/更新/删除/清空某天）
exports.performanceSchedule = async (req, res) => {
    try {

        const { action, performanceId } = req.body;

        if (!action) return res.json(util.fail("操作类型不能为空"));

        if (action == "create") {

            if (!performanceId) return res.json(util.fail("缺少必要参数"));
            let data = await Performance.findByPk(performanceId);
            if (!data) return res.json(util.fail("演出节目不存在"));

            const { weekDay, showTime } = req.body;
            if (weekDay === undefined || weekDay === null) return res.json(util.fail("星期不能为空"));
            if (!showTime) return res.json(util.fail("开演时间不能为空"));

            // 同一演出同一天同一时间只能有一场（对应唯一索引）
            let exist = await PerformanceSchedule.findOne({
                where: {
                    performanceId,
                    weekDay,
                    showTime
                }
            })
            if (exist) return res.json(util.fail("该场次已存在"));

            await PerformanceSchedule.create({
                performanceId,
                weekDay,
                showTime,
                capacity: req.body.capacity ?? null,
                status: req.body.status ?? 1
            });
            return res.json(util.success("创建成功"));

        } else if (action == "batchCreate") {
            // 批量添加场次 schedules: [{ weekDay, showTime, capacity, status }]
            const { schedules } = req.body;
            if (!performanceId) return res.json(util.fail("缺少必要参数"));
            if (!Array.isArray(schedules) || !schedules.length) return res.json(util.fail("场次数据不能为空"));

            let data = await Performance.findByPk(performanceId);
            if (!data) return res.json(util.fail("演出节目不存在"));

            // 过滤掉与已有场次重复的星期+时间（对应唯一索引，自动跳过）
            let existings = await PerformanceSchedule.findAll({
                where: {
                    performanceId
                },
                attributes: ["weekDay", "showTime"]
            })
            const existSet = new Set(existings.map(e => `${e.weekDay}-${e.showTime}`));
            const toCreate = schedules.filter(s => s && s.weekDay != null && s.showTime && !existSet.has(`${s.weekDay}-${s.showTime}`));

            if (toCreate.length) {
                await PerformanceSchedule.bulkCreate(toCreate.map(s => ({
                    performanceId,
                    weekDay: s.weekDay,
                    showTime: s.showTime,
                    capacity: s.capacity ?? null,
                    status: s.status ?? 1
                })));
            }
            return res.json(util.success("添加成功", {
                added: toCreate.length,
                skipped: schedules.length - toCreate.length
            }));

        } else if (action == "update") {
            const { id, weekDay, showTime } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));

            let data = await PerformanceSchedule.findByPk(id);
            if (!data) return res.json(util.fail("演出时间不存在"));

            // 修改时间时校验同演出同天同时间唯一（排除自身）
            let dup = await PerformanceSchedule.findOne({
                where: {
                    performanceId: data.performanceId,
                    weekDay: weekDay ?? data.weekDay,
                    showTime: showTime ?? data.showTime,
                    id: { [Op.ne]: id }
                }
            })
            if (dup) return res.json(util.fail("该场次时间已存在"));

            const values = {};
            if (showTime) values.showTime = showTime;
            if ("capacity" in req.body) values.capacity = req.body.capacity ?? null;
            if ("status" in req.body) values.status = req.body.status;

            if (Object.keys(values).length) {
                await PerformanceSchedule.update(values, {
                    where: {
                        id
                    }
                });
            }
            return res.json(util.success("更新成功"));
        } else if (action == "delete") {
            const { id } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));

            let data = await PerformanceSchedule.findByPk(id);
            if (!data) return res.json(util.fail("演出时间不存在"));

            await PerformanceSchedule.destroy({
                where: {
                    id
                }
            });
            return res.json(util.success("删除成功"));

        } else if (action == "clearDay") {
            // 清空某演出某星期的全部场次（weekDay 为 0 时表示周日，不能用 ! 判断）
            const { weekDay } = req.body;
            if (!performanceId || weekDay === undefined || weekDay === null) return res.json(util.fail("缺少必要参数"));

            const count = await PerformanceSchedule.destroy({
                where: {
                    performanceId,
                    weekDay
                }
            });
            return res.json(util.success(`已清空 ${count} 场次`));

        } else {
            return res.json(util.fail("不支持的操作类型"));
        }

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}

// 获取演出场次列表
exports.performanceScheduleList = async (req, res) => {
    try {
        const { performanceId, weekDay, status } = req.query;

        let where = {};
        if (performanceId) where.performanceId = parseInt(performanceId);
        if (weekDay !== undefined && weekDay !== "") where.weekDay = parseInt(weekDay);
        if (status) where.status = parseInt(status);

        let rows = await PerformanceSchedule.findAll({
            where,
            order: [["weekDay", "asc"], ["showTime", "asc"]],
        })

        return res.json(util.success("获取成功", {
            rows
        }));

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}
