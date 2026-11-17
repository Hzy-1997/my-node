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
const { Reminder, Member } = require("../models/Summary");