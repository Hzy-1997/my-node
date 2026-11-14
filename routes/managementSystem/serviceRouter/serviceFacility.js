
const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");

const { ServiceFacility } = require("../../../models/Summary");


// 服务设施操作（卫生间/吸烟区等通用点位）
exports.serviceFacilityOperation = async (req, res) => {
    try {
        let { action, title, address, location } = req.body

        if (!action) return res.json(util.fail("操作类型不能为空"))

        if (action == "create") {
            if (!title || !address || !location) return res.json(util.fail("缺少必要参数"))

            await ServiceFacility.create({
                ...req.body
            })

            res.json(util.success("创建成功"))

        } else if (action == "update") {
            let { id } = req.body

            if (!id) return res.json(util.fail("缺少必要参数"))
            let status = await ServiceFacility.findOne({ where: { id: id } })
            if (!status) return res.json(util.fail("项目不存在"))
            await ServiceFacility.update({
                ...req.body
            }, {
                where: { id: id }
            })
            res.json(util.success("更新成功"))

        } else if (action == "delete") {
            let { id } = req.body
            if (!id) return res.json(util.fail("缺少必要参数"))
            let status = await ServiceFacility.findOne({ where: { id: id } })
            if (!status) return res.json(util.fail("项目不存在"))
            await ServiceFacility.destroy({
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


// 获取服务设施列表
exports.serviceFacilityList = async (req, res) => {

    try {
        let { title, status, page = 1, pageSize = 10 } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }
        if (status) where.status = parseInt(status)

        page = parseInt(page)
        pageSize = parseInt(pageSize)
        let { rows, count } = await ServiceFacility.findAndCountAll({
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
