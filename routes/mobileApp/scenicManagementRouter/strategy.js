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
const { Strategy, FitnessExercise, Leisure, Restaurant, DiscountStore } = require("../../../models/Summary");
const redisService = require('../../../services/redisService');

// 获取攻略列表
exports.strategyList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10 } = req.query;
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        // 只缓存前三页且 pageSize=10 的请求
        const shouldCache = page <= 3 && pageSize === 10;
        const cacheKey = `strategyList:${page}:${pageSize}`;

        // if (shouldCache) {
        //     const cachedData = await redisService.getFun(cacheKey);
        //     if (cachedData) {
        //         return res.json(util.success("获取成功", cachedData));
        //     }
        // }

        let data = await Strategy.findAndCountAll({
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['id', 'desc']],
            attributes: ["id", "content", "cover", "title"]
        });

        if (!data) return res.json(util.fail("获取失败"));

        // 只有前三页且 pageSize=10 才写入缓存
        // if (shouldCache) {
        //     await redisService.setFun(cacheKey, data, 900);
        // }

        return res.json(util.success("获取成功", data));
    } catch (error) {
        return res.json(util.fail("操作失败", error));
    }
}

// 查询攻略详细
exports.strategyInfo = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))

        let data = await Strategy.findOne({
            where: { id: id }
        })
        if (!data) return res.json(util.fail("未查询到当前攻略"))
        return res.json(util.success("查询成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}

// 查询运动详情
exports.sportsInfo = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))

        let data = await FitnessExercise.findOne({
            where: { id }
        })
        if (!data) return res.json(util.fail("未查询到当前运动"))
        return res.json(util.success("查询成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}

// 查询休闲详情
exports.leisureInfo = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))

        let data = await Leisure.findOne({
            where: { id }
        })
        if (!data) return res.json(util.fail("未查询到当前休闲"))
        return res.json(util.success("查询成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}

// 查询餐饮详情
exports.cateringInfo = async (req, res) => {
    try {
        let { id } = req.query
        console.log("参数", id)
        if (!id) return res.json(util.fail("缺少必要参数"))

        let data = await Restaurant.findOne({
            where: { id }
        })
        if (!data) return res.json(util.fail("未查询到当前餐饮"))
        return res.json(util.success("查询成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}

// 查询购物详情
exports.shoppingInfo = async (req, res) => {
    try {
        let { id } = req.query
        if (!id) return res.json(util.fail("缺少必要参数"))

        let data = await DiscountStore.findOne({
            where: { id }
        })
        if (!data) return res.json(util.fail("未查询到当前购物"))
        return res.json(util.success("查询成功", data))
    } catch (error) {
        return res.json(util.fail("操作失败", error))
    }
}



