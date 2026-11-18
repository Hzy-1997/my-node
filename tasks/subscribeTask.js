/**
 * 订阅提醒定时任务
 *
 * 每30秒扫描 reminder 表：status=1 且 reminderTime <= now 的记录，
 * 先条件更新抢占（1→2，幂等，多实例安全），再调用发送渠道。
 * 发送失败置 status=3，人工排查后可手动重置为1重发。
 *
 * 启动：由 app.js 的 initializeCronJobs() 注册，随主进程运行。
 */
const cron = require("node-cron");
const { Op } = require("sequelize");
const axios = require("axios");
const { Reminder, Member } = require("../models/Summary");
const { getWxAccessToken } = require("../routes/mobileApp/AmethodRouter/index.js");
const redisService = require("../services/redisService");
const { APP_ID, WX_REMINDER_TEMPLATE_ID } = require("../config/index");


// 微信订阅消息 time 字段格式：2026年11月18日 10:00

function formatWxTime(date) {
    const d = new Date(date); // 2026年11月18日 10:00
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 发送渠道入口 —— 渠道分派收敛于此，二期站内信/三期短信在此追加分支
 * 抛出异常 → 主流程置 status=3（43101 未授权等错误同样走此路径，不重试）
 */

async function sendReminder(item) {

    const member = await Member.findOne({
        where: { id: item.userid },
        attributes: ["openId", "userName"] // 只查询 openId 字段，避免返回敏感信息
    })


    if (!member || !member.openld) throw new Error("用户 openid 缺失");


    let payload = {
        template_id: WX_REMINDER_TEMPLATE_ID, // 模板ID
        page: APP_ID, // 页面路径
        touser: member.openld, // 接收者openid
        data: {
            // 键名严格对应你的模板详细内容
            thing1: {
                value: item.serviceName, // 对应：活动主题（填入你的演出名称，比如《千古情》）
            },
            date2: {
                value: formatWxTime(item.reminderTime), // 对应：开始时间（必须严格按时间格式，见下方说明）
            },
            thing4: {
                value: item.serviceAddress, // 对应：活动地点（填入演出地址）
            },
            thing7: {
                value: '提前10分钟', // 对应：提醒时机（填固定值即可）
            },
            thing9: {
                value: '演出即将开始，请尽快入场', // 对应：备注（温馨提示）
            }
        },
    }


    const send = (token) =>
        axios.post(
            `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
            payload,
        );

    let { data } = await send(await getWxAccessToken());

}




























































