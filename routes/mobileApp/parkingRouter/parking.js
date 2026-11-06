/*
 * @描述: 停车场移动端订单查询接口
 * @作者:
 * @日期: 2026-11-06
 */

// 工具
const { Op } = require('sequelize');
const util = require("../../../utils/util");

var jwt = require('jsonwebtoken');
const { secretJwt } = require('../../../config/index.js');

// 引入模型
const { Parking, ParkingSpot, ParkingReservation } = require("../../../models/Summary")


// 停车场预约订单信息
// 说明：停车订单是单表结构（ParkingReservation），关联停车场（Parking）和车位（ParkingSpot）
//       列表/详情都用 orderNumber（订单号）定位订单
//       分页查询：page=页码（默认1） pageSize=每页数量（默认10）
//       状态筛选：payStatus=状态（0=全部支付状态）
//       详情查询：orderNumber=订单号（查单个订单详情）
// 特殊说明：停车业务 payStatus 跳过 2（已支付），直接 1(待支付)→3(已完成)，仅管理员可退款
exports.getParkingOrderInfo = async (req, res) => {

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

        // 3. 关联查询：停车场、车位信息 LEFT JOIN
        const include = [
            { model: Parking, as: 'parking', attributes: ['id', 'title', 'image', 'businessHours', 'phone', 'locationDesc', 'price'], required: false }, // 停车场
            { model: ParkingSpot, as: 'spot', attributes: ['id', 'spotNumber', 'area', 'spotType'], required: false },                                       // 车位
        ];

        // 4. 查询数据库
        if (orderNumber) {
            const order = await ParkingReservation.findOne({
                where,
                include
            });

            if (!order) {
                return res.json(util.fail("订单不存在或无权查看"));
            }

            return res.json(util.success("获取成功", encryptParkingOrder(order.toJSON())));
        }

        // 列表：主表一单一行
        const { count, rows } = await ParkingReservation.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["id", "DESC"]],
            include
        });

        // 5. 敏感字段加密后返回
        const list = rows.map(row => encryptParkingOrder(row.toJSON()));

        return res.json(util.success("获取成功", {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }))

    } catch (error) {
        console.error("获取停车订单信息错误:", error);
        return res.json(util.fail("系统出现错误", error.message));
    }
}

// 敏感字段加密（项目约定：订单接口的 phone、idCard、carNumber 加密后传输）
function encryptParkingOrder(orderJson) {
    // 订单级：联系电话、身份证、车牌号
    if (orderJson.phone) {
        orderJson.phone = util.encrypt(String(orderJson.phone));
    }
    if (orderJson.idCard) {
        orderJson.idCard = util.encrypt(String(orderJson.idCard));
    }
    if (orderJson.carNumber) {
        orderJson.carNumber = util.encrypt(String(orderJson.carNumber));
    }
    return orderJson;
}
