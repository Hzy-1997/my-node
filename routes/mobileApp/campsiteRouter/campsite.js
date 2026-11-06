/*
 * @描述: 夏令营移动端接口
 * @作者:
 * @日期: 2026-11-06
 */

// 工具
const { Op } = require('sequelize');
const util = require("../../../utils/util");

var jwt = require('jsonwebtoken');
const { secretJwt } = require('../../../config/index.js');

// 首先引入所有模型
const { campOrders, campOrderParticipants, Campsite, CampSession, TicketType } = require("../../../models/Summary")



// 夏令营订单信息
// 说明：夏令营订单是"主表一单一行 + 营员明细表"结构（campOrders 一行、campOrderParticipants 每营员一行），
//       列表/详情都用 orderNumber（订单号）定位订单
//       分页查询：page=页码（默认1） pageSize=每页数量（默认10）
//       状态筛选：payStatus=状态（0=全部支付状态）
//       详情查询：orderNumber=订单号（查单个订单详情）
exports.getCampOrderInfo = async (req, res) => {

    // 1. 接收参数：orderNumber=订单号（查单个订单详情） payStatus=状态筛选（不传或0=全部）
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
            // token 过期或无效：返回明确的授权错误（前端据此跳转登录页），而不是笼统的"系统出现错误"
            if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
                return res.json(util.fail("无效的会话，或者会话已过期，请重新登录。", "", util.CODE.AUTH_ERROR));
            }
            throw err;
        }

        // 2. 查询条件：只能查当前登录用户自己的订单（夏令营订单表用户字段是 userId）
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

        // 3. 关联查询：营地、场次、票档、营员明细全部 LEFT JOIN 一次查出来
        const include = [
            { model: Campsite, as: 'campsite', attributes: ['id', 'title', 'image', 'locationDesc', 'phone'], required: false }, // 营地
            { model: CampSession, as: 'session', attributes: ['id', 'sessionName', 'startDate', 'endDate'], required: false },   // 场次
            { model: TicketType, as: 'ticketType', attributes: ['id', 'ticketName', 'price'], required: false },               // 票档
            { model: campOrderParticipants, as: 'participants', required: false },  // 营员明细（一单多人）
        ];

        // 4. 查询数据库
        if (orderNumber) {
            const order = await campOrders.findOne({
                where,
                include
            });

            if (!order) {
                return res.json(util.fail("订单不存在或无权查看"));
            }

            return res.json(util.success("获取成功", encryptCampOrder(order.toJSON())));
        }

        // 列表：主表一单一行；带 hasMany（营员明细）时 distinct 让 count 按订单数计算
        const { count, rows } = await campOrders.findAndCountAll({
            where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["id", "DESC"]],
            distinct: true,
            include
        });

        // 5. 敏感字段加密后返回（项目约定：salt:iv:encrypted 格式）
        const list = rows.map(row => encryptCampOrder(row.toJSON()));

        return res.json(util.success("获取成功", {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }))

    } catch (error) {
        console.error("获取夏令营订单信息错误:", error);
        return res.json(util.fail("系统出现错误", error.message));
    }
}

// 敏感字段加密（项目约定：订单接口的 userPhone、parentPhone、parentIdCard、营员 idCard 加密后传输）
function encryptCampOrder(orderJson) {
    // 订单级：下单人电话
    if (orderJson.userPhone) {
        orderJson.userPhone = util.encrypt(String(orderJson.userPhone));
    }
    // 营员明细级：身份证、家长电话、家长身份证
    if (Array.isArray(orderJson.participants)) {
        orderJson.participants.forEach(p => {
            if (p.idCard) p.idCard = util.encrypt(String(p.idCard));
            if (p.parentPhone) p.parentPhone = util.encrypt(String(p.parentPhone));
            if (p.parentIdCard) p.parentIdCard = util.encrypt(String(p.parentIdCard));
        });
    }
    return orderJson;
}
