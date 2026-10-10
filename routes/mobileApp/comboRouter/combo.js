/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */


// 工具
const { Op } = require('sequelize');
const { Sequelize, DataTypes } = require('sequelize');
const util = require("../../../utils/util");
const { calculateDatePrices } = require("../ADateConfiguration/index");

// 首先引入所有模型
const { ProductPackage, PackageItem, PackagePriceRule, PackageDatePrice, PackageOrderDetail, RoomType, Member, Hotel, } = require("../../../models/Summary")




// 套餐列表
exports.comboList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, type, name, status } = req.query

        let where = {}
        if (type) where.type = type
        if (name) where.name = name
        if (status) where.status = status
        const { count, rows } = await ProductPackage.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["id", "DESC"]],
        })

        let list = util.formDate(rows)

        return res.json(util.success("获取成功", {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }))

    } catch (err) {
        return res.json(util.fail("操作失败", err.message))
    }
}


// 购买套餐
exports.buyCombo = async (req, res) => {
    try {
        const { userId, packageItemId, itemType, num, startDate, endDate } = req.body

        // if (!userId || !packageItemId || !itemType || !num || !startDate || !endDate) {
        //     return res.json(util.fail("缺少必要信息"))
        // }
        // if (num > 5) return res.json(util.fail("最大购买数量不能超过5个"))
        // const combo = await PackageItem.findOne({ where: { id: packageItemId } })
        // if (!combo) return res.json(util.fail("套餐不存在"))
        // if (combo.status != 1) return res.json(util.fail("套餐不可用"))
        // if (itemType != 1 && itemType != 2) return res.json(util.fail("类型错误"))
        // const user = await Member.findOne({ where: { id: userId } })
        // if (!user) return res.json(util.fail("用户不存在"))

        // 生成订单号
        let orderNo = await util.generateOrderNo("ORDJD");

        // 酒店
        if (itemType == 1) {
            const room = await RoomType.findOne({ where: { id: combo.roomPackageId } })
            if (!room) return res.json(util.fail("房间类型不存在"))
            if (room.status != 1) return res.json(util.fail("房间类型不可用"))
            let datePrice = await PackageDatePrice.findAll({ where: { packageId: combo.id, date: { [Op.between]: [startDate, endDate] } } })
            // if (!datePrice) return res.json(util.fail("套餐日期价格不存在"))
            console.log()





            // 票务
        } else if (itemType == 2) {

        }


        return res.json(util.success("购买成功", orderNo, datePrice))

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }
}




