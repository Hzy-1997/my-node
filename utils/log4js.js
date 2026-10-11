/*
 * @Descripttion: 日志存储
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-22 09:45:10
 * @LastEditors: sueRimn
 * @LastEditTime: 2025-07-22 09:48:58
 */

const log4js = require('log4js')


// 配置日志等级
let levels = {
    trace: log4js.levels.TRACE,
    debug: log4js.levels.DEBUG,
    info: log4js.levels.INFO,
    warn: log4js.levels.WARN,
    error: log4js.levels.ERROR,
    fatal: log4js.levels.FATAL
}


// 配置日志级别
log4js.configure({
    appenders: {
        console: {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %c - %m'
            }
        },
        info: {
            type: 'file',
            filename: 'log/info/info-log.log',
            pattern: 'yyyy-MM-dd',
            alwaysIncludePattern: true, // 设置为true，则日志文件名总是包含pattern部分
            layout: {
                type: 'pattern',
                pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %c - %m'
            }
        },
        error: {
            type: 'dateFile',
            filename: 'log/error/error-log.log',
            pattern: 'yyyy-MM-dd',
            alwaysIncludePattern: true,
            layout: {
                type: 'pattern',
                pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %c - %m'
            }
        }
    },
    categories: {
        default: { appenders: ['console'], level: 'debug' },
        info: { appenders: ['info', 'console'], level: 'info' },
        error: { appenders: ['error', 'console'], level: 'error' }
    }
});


// 日志输出
const recordebug = (Content, level) => {
    let logger = log4js.getLogger("debug"); // 创建一个logger实例
    logger.level = levels.debug; // 设置日志级别
    logger.debug(Content); // 记录日志
}

const recorderror = (Content) => {
    let logger = log4js.getLogger('error'); // 创建一个logger实例
    logger.level = levels.error; // 设置日志级别
    logger.error(Content); // 记录日志
}

const recordinfo = (Content) => {
    let logger = log4js.getLogger("info"); // 创建一个logger实例
    logger.level = levels.info; // 设置日志级别
    logger.info(Content); // 记录日志
}

// 导出两个函数
module.exports = {
    recordebug,
    recorderror,
    recordinfo
};