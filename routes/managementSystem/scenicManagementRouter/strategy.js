/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */


const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { Strategy, FitnessExercise, Leisure, Restaurant, DiscountStore, } = require("../../../models/Summary");

// 攻略模块操作
exports.strategyOperate = async (req, res) => {
    try {
        const { id, action, title } = req.body
        if (!action) return res.json(util.fail("操作失败,缺少必要参数"))

        if (action == "create") {
            if (!title) return res.json(util.fail("操作失败,缺少必要参数"))
            let status = await Strategy.findOne({ where: { title } })
            if (status) return res.json(util.fail("操作失败,该标题已存在"))
            await Strategy.create(req.body)
            return res.json(util.success("操作成功"))


        } else if (action == "update") {
            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let status = await Strategy.findOne({ where: { id } })
            if (!status) return res.json(util.fail("操作失败,该攻略不存在"))
            await Strategy.update(req.body, { where: { id } })
            return res.json(util.success("更新成功"))


        } else if (action == "delete") {
            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let status = await Strategy.findOne({ where: { id } })
            if (!status) return res.json(util.fail("操作失败,该攻略不存在"))
            await Strategy.destroy({ where: { id } })
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}
// 获取攻略列表
exports.strategyList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query

        let where = {}
        if (title) {
            where.title = {
                [Op.like]: `%${title}%`
            }
        }
        let { rows, count } = await Strategy.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
            order: [['id', 'desc']]
        })

        if (!rows) return res.json(util.fail("获取失败"))
        let data = {
            list: rows,
            total: count,
            page,
            pageSize
        }
        return res.json(util.success("获取成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败1", error))

    }
}


// 运动相关
exports.sportsOperation = async (req, res) => {
    let { id, action, title } = req.body
    if (!action) return res.json(util.fail("操作失败,缺少必要参数"));
    try {
        if (action == "create") {

            if (!title) return res.json(util.fail("操作失败,缺少必要参数"));
            let data = await FitnessExercise.findOne({
                where: {
                    title
                }
            })
            if (data) return res.json(util.fail("操作失败,该标题已存在"))
            let status = await FitnessExercise.create(req.body)
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("创建成功"))

        } else if (action == "update") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await FitnessExercise.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该运动不存在"))

            let status = await FitnessExercise.update(req.body, {
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await FitnessExercise.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该运动不存在"))
            let status = await FitnessExercise.destroy({
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("删除成功"))
        }


    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}
// 获取运动列表
exports.getFitnessExerciseList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }


        let { rows, count } = await FitnessExercise.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
            order: [
                ['id', 'desc']
            ]
        })
        let data = {
            list: rows,
            total: count,
            page,
            pageSize
        }
        return res.json(util.success("获取成功", data))
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}


//休闲相关操作
exports.leisureOperation = async (req, res) => {
    let { id, action, title } = req.body
    if (!action) return res.json(util.fail("操作失败,缺少必要参数"));
    try {
        if (action == "create") {
            if (!title) return res.json(util.fail("操作失败,缺少必要参数"));
            let data = await Leisure.findOne({
                where: {
                    title
                }
            })
            if (data) return res.json(util.fail("操作失败,该标题已存在"))
            let status = await Leisure.create(req.body)
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("创建成功"))

        } else if (action == "update") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await Leisure.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await Leisure.update(req.body, {
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await Leisure.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await Leisure.destroy({
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }

}
// 获取休闲列表
exports.getLeisureList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }


        let { rows, count } = await Leisure.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
            order: [
                ['id', 'desc']
            ]
        })
        let data = {
            list: rows,
            total: count,
            page,
            pageSize
        }
        return res.json(util.success("获取成功", data))
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}


// 餐饮操作 Restaurant 
exports.cateringOperations = async (req, res) => {
    let { id, action, title } = req.body
    if (!action) return res.json(util.fail("操作失败,缺少必要参数"));
    try {
        if (action == "create") {
            if (!title) return res.json(util.fail("操作失败,缺少必要参数"));
            let data = await Restaurant.findOne({
                where: {
                    title
                }
            })
            if (data) return res.json(util.fail("操作失败,该标题已存在"))
            let status = await Restaurant.create(req.body)
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("创建成功"))

        } else if (action == "update") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await Restaurant.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await Restaurant.update(req.body, {
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await Restaurant.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await Restaurant.destroy({
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}
// 获取餐饮列表
exports.getRestaurantList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }


        let { rows, count } = await Restaurant.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
            order: [
                ['id', 'desc']
            ]
        })
        let data = {
            list: rows,
            total: count,
            page,
            pageSize
        }
        return res.json(util.success("获取成功", data))
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}


//购物操作 DiscountStore
exports.shoppingOperations = async (req, res) => {
    let { id, action, title } = req.body
    if (!action) return res.json(util.fail("操作失败,缺少必要参数"));
    try {
        if (action == "create") {
            if (!title) return res.json(util.fail("操作失败,缺少必要参数"));
            let data = await DiscountStore.findOne({
                where: {
                    title
                }
            })
            if (data) return res.json(util.fail("操作失败,该标题已存在"))
            let status = await DiscountStore.create(req.body)
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("创建成功"))

        } else if (action == "update") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await DiscountStore.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await DiscountStore.update(req.body, {
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("更新成功"))

        } else if (action == "delete") {

            if (!id) return res.json(util.fail("操作失败,缺少必要参数"))
            let data = await DiscountStore.findOne({
                where: {
                    id
                }
            })
            if (!data) return res.json(util.fail("操作失败,该数据不存在"))
            let status = await DiscountStore.destroy({
                where: {
                    id
                }
            })
            if (!status) return res.json(util.fail("操作失败"))
            return res.json(util.success("删除成功"))
        }

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}
// 获取购物列表
exports.getShoppingList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, title } = req.query

        let where = {}
        if (title) where.title = { [Op.like]: `%${title}%` }


        let { rows, count } = await DiscountStore.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: parseInt(pageSize),
            order: [
                ['id', 'desc']
            ]
        })
        let data = {
            list: rows,
            total: count,
            page,
            pageSize
        }
        return res.json(util.success("获取成功", data))
    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}