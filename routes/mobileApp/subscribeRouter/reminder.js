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
var jwt = require('jsonwebtoken');
const util = require("../../../utils/util");
const { Reminder, Member } = require("../../../models/Summary");
const { secretJwt } = require('../../../config/index.js');




// 用户订阅提醒
exports.reminder = async (req, res) => {
    try {

        if (!req.headers.authorization) {
            return res.json(util.fail("未登录，请先登录"));
        }

        let token = req.headers.authorization.replace("Bearer ", "");
        if (!token) {
            return res.json(util.fail("登录信息无效，请重新登录"));
        }

        // 捕获 jwt 的验证错误，判断是否是过期的 token
        let userInfo;
        try {
            userInfo = jwt.verify(token, secretJwt.secret);
        } catch (error) {
            return res.json(util.fail("无效的登录信息，请重新登录"));
        }

        console.log('userInfo', userInfo)

        const { projectId, reminderTime } = req.body;

        if (!projectId || !reminderTime) {
            return res.json(util.fail("数据出错了"))
        }

        let data = await Member.findOne({
            where: {
                id: userInfo.id,
            }
        })
        if (!data) {
            return res.json(util.fail("用户不存在"))
        }

        const reminder = await Reminder.create({
            ...req.body,
            userId: userInfo.id,
            reminderType: req.body.reminderType || '开演提醒',
            status: 1,
        });
        if (!reminder) {
            return res.json(util.fail("订阅失败"))
        }

        return res.json(util.success("订阅成功"))

    } catch (error) {
        return res.json(util.fail("系统错误", error.message))
    }

}