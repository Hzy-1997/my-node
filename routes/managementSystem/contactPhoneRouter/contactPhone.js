
const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");

const { contactPhone } = require("../../../models/Summary");


// 联系电话操作（创建/更新/删除）
exports.contactPhoneOperation = async (req, res) => {
    try {
        let { action, id, title, phone, type, area, description, status, sortOrder } = req.body

        if (!action) return res.json(util.fail("操作类型不能为空"))

        if (action == "create") {
            if (!title || !phone) return res.json(util.fail("缺少必要参数"))

            // 同名电话去重
            let exist = await contactPhone.findOne({
                where: { title: title }
            })
            if (exist) return res.json(util.fail("该电话名称已存在"))

            await contactPhone.create({
                title,
                phone,
                type: type || 1,
                area,
                description,
                status: status || 1,
                sortOrder: sortOrder || 0,
            })

            res.json(util.success("创建成功"))

        } else if (action == "update") {

            if (!id) return res.json(util.fail("缺少必要参数"))
            let info = await contactPhone.findOne({ where: { id: id } })
            if (!info) return res.json(util.fail("项目不存在"))

            await contactPhone.update({
                title,
                phone,
                type,
                area,
                description,
                status,
                sortOrder,
            }, {
                where: { id: id }
            })
            res.json(util.success("更新成功"))

        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少必要参数"))
            let info = await contactPhone.findOne({ where: { id: id } })
            if (!info) return res.json(util.fail("项目不存在"))
            await contactPhone.destroy({
                where: { id: id }
            })
            res.json(util.success("删除成功"))
        } else {
            return res.json(util.fail("不支持的操作类型"))
        }

    } catch (error) {
        return res.json(util.fail(error.message))
    }
}


// 获取联系电话列表
exports.contactPhoneList = async (req, res) => {

    try {
        let { title, phone, type, status, page = 1, pageSize = 10 } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }
        if (phone) where.phone = { [Op.like]: `%${phone}%` }
        if (type) where.type = parseInt(type)
        if (status) where.status = parseInt(status)

        page = parseInt(page)
        pageSize = parseInt(pageSize)
        let { rows, count } = await contactPhone.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['sortOrder', 'ASC'], ['id', 'DESC']],
        })
        res.json(util.success("获取成功", {
            rows: util.formDate(rows),
            count,
        }
        ))

    } catch (error) {
        return res.json(util.fail(error.message))

    }
}
