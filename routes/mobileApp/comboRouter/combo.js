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
const { calculateDatePrices } = require("../../managementSystem/ADateConfiguration/index");

var jwt = require('jsonwebtoken');
const { secretJwt } = require('../../../config/index.js');

// 首先引入所有模型
const { ProductPackage, PackageItem, PackagePriceRule, PackageDatePrice, PackageOrderDetail, RoomType, RoomPackage, Ticket, Member, Hotel, } = require("../../../models/Summary")




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


// 套餐订单信息
// 说明：套餐订单是"一单多明细"结构（orderNumber 相同的 1 条主产品 + N 条附带品），
//       所以详情查询用 orderNumber（订单号），不能用明细行的 id
exports.getComboOrderInfo = async (req, res) => {

    // 1. 接收参数：orderNumber=订单号（查单个订单详情） payStatus=状态筛选（不传或0=全部）
    const { payStatus, orderNumber, page = 1, pageSize = 10 } = req.query;

    try {
        if (!req.headers.authorization) {
            return res.json(util.fail("未登录，请先登录"));
        }

        let token = req.headers.authorization.replace("Bearer ", "");
        if (!token) {
            return res.json(util.fail("登录信息无效，请重新登录"));
        }

        let userInfo;
        try {
            userInfo = jwt.verify(token, secretJwt.secret);
        } catch (err) {
            // token 过期或无效：返回明确的授权错误（前端据此跳转登录页），而不是笼统的"系统出现错误"
            if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
                return res.json(util.fail("无效的会话，或者会话已过期，请重新登录。", "", util.CODE.AUTH_ERROR));
            }
            throw err;
        }

        // 2. 查询条件：只能查当前登录用户自己的订单
        //    注意：套餐订单表的用户字段是 userId（票务订单表才是 memberId）
        let where = {
            userId: userInfo.id
        };

        // 详情查询：查该订单号下的全部明细（主产品+附带品）
        if (orderNumber !== undefined && orderNumber !== null && orderNumber !== '') {
            where.orderNumber = orderNumber;
        }

        if (payStatus !== undefined && payStatus !== null && payStatus !== '' && payStatus !== '0') {
            where.payStatus = Number(payStatus);
        }

        // 3. 关联查询：套餐、酒店、票务全部用 LEFT JOIN 一起查，不需要先判断 itemType
        //    itemType=1 的行 roomPackage 有值、ticket 为 null；itemType=2 的行相反
        //    以后新增子项类型（如观光车），只需在这里多加一个 include
        const include = [
            { model: ProductPackage, as: 'package', required: false },  // 所属套餐（packageId）
            { model: RoomPackage, as: 'roomPackage', required: false }, // 关联酒店房型套餐（itemType=1）
            { model: Ticket, as: 'ticket', required: false },           // 关联门票（itemType=2）
        ];

        // 4. 查询数据库
        if (orderNumber) {
            // 详情：查该订单号下全部明细（主产品在前）
            const rows = await PackageOrderDetail.findAll({
                where,
                order: [["isPrimary", "DESC"], ["id", "ASC"]],
                include
            });

            if (rows.length === 0) {
                return res.json(util.fail("订单不存在或无权查看"));
            }

            // 按订单号组装成一单：订单级信息取主产品的，items 放全部明细
            return res.json(util.success("获取成功", buildOrder(rows)[0]));
        }

        // 列表：一单一行（只查主产品 isPrimary=1，分页才正确），附带品再补查
        const { count, rows } = await PackageOrderDetail.findAndCountAll({
            where: { ...where, isPrimary: 1 },
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["id", "DESC"]],
            include
        });

        // 把当前页订单的附带品一次性查出来，按订单号分组塞回去
        if (rows.length > 0) {
            const orderNumbers = rows.map(r => r.orderNumber);
            const attachedRows = await PackageOrderDetail.findAll({
                where: { orderNumber: { [Op.in]: orderNumbers }, isPrimary: 0 },
                order: [["id", "ASC"]],
                include
            });
            rows.push(...attachedRows);
        }

        // 5. 按订单号分组组装：每个订单 = 订单级信息 + items（主产品+附带品明细）
        const list = buildOrder(rows);

        return res.json(util.success("获取成功", {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }))

    } catch (error) {
        console.error("获取套餐订单信息错误:", error);
        return res.json(util.fail("系统出现错误", error.message));
    }
}

// 把明细行按订单号组装成订单结构：订单级信息取第一条（主产品）的，items 放全部明细
function buildOrder(rows) {
    const orderMap = {};
    rows.forEach(row => {
        const item = row.toJSON();
        if (!orderMap[item.orderNumber]) {
            orderMap[item.orderNumber] = {
                orderNumber: item.orderNumber,
                title: item.title,
                payStatus: item.payStatus,
                orderAmount: item.orderAmount,
                refundAmount: item.refundAmount,
                paymentTime: item.paymentTime,
                refundTime: item.refundTime,
                cancelReason: item.cancelReason,
                createdAt: item.createdAt,
                package: item.package || null, // 所属套餐信息（同一订单所有明细的套餐相同）
                items: []
            };
        }
        orderMap[item.orderNumber].items.push(item);
    });
    return Object.values(orderMap);
}




