/*
 * @描述: 景区公交（班车）移动端订单查询接口
 * @作者:
 * @日期: 2026-11-06
 */

// 工具
const { Op } = require('sequelize');
const util = require("../../../utils/util");

var jwt = require('jsonwebtoken');
const { secretJwt } = require('../../../config/index.js');

// 引入模型
const { ScenicBus, ScenicBusOrder, ScenicBusOrderTicket } = require("../../../models/Summary")


// 景区公交订单信息
// 说明：班车订单是"主表一单一行 + 车票明细表"结构（ScenicBusOrder 一行、ScenicBusOrderTicket 每票一行），
//       列表/详情都用 orderNumber（订单号）定位订单
//       分页查询：page=页码（默认1） pageSize=每页数量（默认10）
//       状态筛选：payStatus=状态（0=全部支付状态）
//       详情查询：orderNumber=订单号（查单个订单详情）
exports.getScenicBusOrderInfo = async (req, res) => {

    // 1. 接收参数
    let { payStatus, orderNumber, page = 1, pageSize = 10 } = req.query;

    try {

        page = parseInt(page);
        pageSize = parseInt(pageSize);

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
            if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
                return res.json(util.fail("无效的会话，或者会话已过期，请重新登录。", "", util.CODE.AUTH_ERROR));
            }
            throw err;
        }

        // 2. 查询条件：只能查当前登录用户自己的订单
        let where = {
            userId: userInfo.id
        };

        // 详情查询：按订单号查
        if (orderNumber !== undefined && orderNumber !== null && orderNumber !== '') {
            where.orderNumber = orderNumber;
        }

        if (payStatus !== undefined && payStatus !== null && payStatus !== '' && payStatus !== '0') {
            where.payStatus = Number(payStatus);
        }

        // 3. 关联查询：景区公交班次、车票明细全部 LEFT JOIN
        const include = [
            { model: ScenicBus, as: 'scenicBus', attributes: ['id', 'title', 'image', 'startStation', 'endStation', 'timeSlot'], required: false }, // 公交班次
            { model: ScenicBusOrderTicket, as: 'tickets', required: false },  // 车票明细（一票一码）
        ];

        // 4. 查询数据库
        if (orderNumber) {
            const order = await ScenicBusOrder.findOne({
                where,
                include
            });

            if (!order) {
                return res.json(util.fail("订单不存在或无权查看"));
            }

            return res.json(util.success("获取成功", encryptScenicBusOrder(order.toJSON())));
        }

        // 列表：主表一单一行；带 hasMany（车票明细）时 distinct 让 count 按订单数计算
        const { count, rows } = await ScenicBusOrder.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["id", "DESC"]],
            distinct: true,
            include
        });

        // 5. 敏感字段加密后返回
        const list = rows.map(row => encryptScenicBusOrder(row.toJSON()));

        return res.json(util.success("获取成功", {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }))

    } catch (error) {
        console.error("获取景区公交订单信息错误:", error);
        return res.json(util.fail("系统出现错误", error.message));
    }
}

// 敏感字段加密（项目约定：订单接口的 userPhone、contactName 加密后传输）
function encryptScenicBusOrder(orderJson) {
    // 订单级：下单人电话、联系人姓名
    if (orderJson.userPhone) {
        orderJson.userPhone = util.encrypt(String(orderJson.userPhone));
    }
    if (orderJson.contactName) {
        orderJson.contactName = util.encrypt(String(orderJson.contactName));
    }
    return orderJson;
}
