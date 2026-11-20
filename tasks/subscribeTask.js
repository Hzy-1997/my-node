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

    console.log("数据查看", item)

    return; // 测试用，屏蔽发送

    const member = await Member.findOne({
        where: { id: item.userId },
        attributes: ["openId", "userName"] // 只查询 openId 字段，避免返回敏感信息
    })


    if (!member || !member.openId) throw new Error("用户 openid 缺失");


    let payload = {
        template_id: WX_REMINDER_TEMPLATE_ID, // 模板ID
        page: APP_ID, // 页面路径
        touser: member.openId, // 接收者openid
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
                value: '演出即将开始', // 对应：备注（温馨提示）
            }
        },
    }


    const send = (token) =>
        axios.post(
            `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
            payload,
        );

    let { data } = await send(await getWxAccessToken());

    // access_token 失效（40001/42001）：清缓存重取，重发一次
    if (data.errcode === 40001 || data.errcode === 42001) {
        await redisService.delFun(`accessToken:wx:${APP_ID}`).catch(() => { });
        ({ data } = await send(await getWxAccessToken()));
    }

    if (data.errcode !== 0) {
        throw new Error(`微信订阅消息发送失败: ${data.errcode} ${data.errmsg}`);
    }

}


async function scanAndSendReminders() {
    const now = new Date();

    // 只捞待发送且提醒时间已到的，limit 100 防大结果集
    const due = await Reminder.findAll({
        where: {
            status: 1,
            reminderTime: { [Op.lte]: now }  // 小于等于当前时间
        },
        include: [{
            model: Member,
            as: 'member',
            // attributes: ['openId', 'userName'] // 只查询 openId 字段，避免返回敏感信息
        }],
        order: [['reminderTime', 'ASC']], // 按提醒时间从早到晚排序，先到期的先处理
        limit: 100, // 限制结果集数量
    })

    console.log("预约数据", due)

    for (const item of due) {

        // ① 抢占：条件更新保证幂等，更新行数=0 说明已被处理，跳过
        const [claimed] = await Reminder.update(
            { status: 2 },
            { where: { id: item.id, status: 1 } },
        );
        if (claimed === 0) continue;

        try {
            await sendReminder(item);
        } catch (error) {
            await Reminder.update(
                { status: 3 },
                { where: { id: item.id, status: 2 } },
            );
            console.error(`[Reminder] 发送失败: id=${item.id}`, error.message);
        }
    }

}


function start() {
    // 每30秒扫描一次，与 orderExpireTask 保持一致
    cron.schedule("*/30 * * * * *", async () => {
        await scanAndSendReminders();
    });
    console.log("[Reminder] 订阅提醒定时任务已启动（每30秒扫描）");
}


module.exports = { start, scanAndSendReminders };



























































