const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");

const { opinionsFeedback, Member } = require("../../../models/Summary")


// 用户意见反馈操作
exports.feedbackOperation = async (req, res) => {
    try {
        let { openld, userPhone, action } = req.body

        if (!action) return res.json(util.fail("操作类型不能为空"))

        if (action == "create") {
            // 用户提交反馈需要校验用户信息（管理端更新/删除无需传）
            if (!openld || !userPhone) return res.json(util.fail("用户ID、手机号或操作不能为空"))

            userPhone = util.decrypt(userPhone)

            // 检查用户是否存在
            let user = await Member.findOne({
                where: {
                    openld: openld
                }
            })
            if (!user) return res.json(util.fail("用户不存在，请先注册"))


            let feedback = await opinionsFeedback.create({
                ...req.body,
                openld,
                userPhone
            })
            if (!feedback) return res.json(util.fail("提交失败"))
            return res.json(util.success("提交成功"))
        } else if (action == "update") {
            let { id } = req.body;
            if (!id) return res.json(util.fail('缺少必要参数'));

            let feedback = await opinionsFeedback.findOne({
                where: {
                    id
                }
            })
            if (!feedback) return res.json(util.fail("意见反馈不存在"))
            await opinionsFeedback.update({
                ...req.body
            }, {
                where: {
                    id
                }
            })
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {
            let { id } = req.body;
            if (!id) return res.json(util.fail('缺少必要参数'));

            let feedback = await opinionsFeedback.findOne({
                where: {
                    id
                }
            })
            if (!feedback) return res.json(util.fail("意见反馈不存在"))
            await feedback.destroy()
            return res.json(util.success("删除成功"))
        } else {
            return res.json(util.fail("不支持的操作类型"))
        }

    } catch (error) {
        res.json(util.fail(error.message))
    }
}

// 获取用户意见反馈列表
exports.getFeedbackList = async (req, res) => {
    try {
        let { openld, type, isHandle, content, page = 1, pageSize = 10 } = req.query

        let where = {}
        if (openld) where.openld = openld
        if (type) where.type = parseInt(type)
        if (isHandle) where.isHandle = parseInt(isHandle)
        if (content) where.content = { [Op.like]: `%${content}%` }
        page = parseInt(page)
        pageSize = parseInt(pageSize)

        let { rows, count } = await opinionsFeedback.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['id', 'DESC']],
        })
        return res.json(util.success("获取成功", {
            rows: util.formDate(rows),
            count,
        }
        ))
    } catch (error) {
        res.json(util.fail(error.message))
    }
}