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
const { Reminder, Member } = require("../../../models/Summary");




// 用户订阅提醒
exports.reminder = async (req, res) => {
    try {
        const { userId, projectId, reminderTime } = req.body;

        if (!userId || !projectId || !reminderTime) {
            return res.json(util.error("数据出错了"))
        }

        let data = await Member.findOne({
            where: {
                id: userId,
            }
        })
        if (!data) {
            return res.json(util.error("用户不存在"))
        }

        const reminder = await Reminder.create({
            ...req.body,
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