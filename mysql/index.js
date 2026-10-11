/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-17 16:35:40
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-09-03 10:55:19
 */
/**
 * 
 * @param {*} res   数据库链接成功的回调
 * @param {*} err   数据库链接失败的回调
 */



// module.exports = function (res, err) {

//     if (typeof res === "function") {
//         err = function () {
//             console.log("数据库链接失败");
//         }
//     }

//     // 引入数据库模块
//     const mysql = require("mysql2");

//     // 导入配置文件
//     const { DBHOST, DBUSER, DBPORT, DBNAME, DBPASSWORD } = require("../config/index");

//     // 创建数据库连接池
//     const pool = mysql.createPool({
//         host: DBHOST, // 数据库主机
//         port: DBPORT, // 数据库端口
//         user: DBUSER, // 数据库用户
//         password: DBPASSWORD, // 数据库密码
//         database: DBNAME, // 数据库名称
//         waitForConnections: true,
//         connectionLimit: 10,  // 最大连接数
//         queueLimit: 0         // 排队请求限制（0表示不限制）
//     });

//     // 模拟数据库连接成功事件
//     function onDatabaseOpen() {
//         console.log('数据库连接成功');
//         console.log('启动成功 地址: http://127.0.0.1:3000')

//     }

//     // 模拟数据库连接失败事件
//     function onDatabaseError(err) {
//         console.error('数据库连接失败:', err);
//         console.log("数据库连接失败: " + err.stack);
//     }

//     // 模拟数据库连接关闭事件
//     function onDatabaseClose() {
//         console.log('数据库连接关闭');
//     }

//     // 获取连接池中的连接
//     pool.getConnection(function (err, connection) {
//         if (err) {
//             onDatabaseError(err);
//             onDatabaseClose();  // 连接关闭事件
//             return;
//         }

//         onDatabaseOpen(); // 连接成功事件
//         res(connection);  // 执行数据库连接成功后的回调函数

//         // // 确保在使用完连接后释放它
//         // connection.release();
//         // onDatabaseClose();  // 连接关闭事件
//     });
// }



/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-18 16:03:12
 * @LastEditors: sueRimn
 * @LastEditTime: 2025-07-18 17:23:00
 */
const { Sequelize } = require('sequelize');
const config = require('../config/config.json');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];
// console.log("dbConfig", dbConfig);
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    timezone: dbConfig.timezone,
    // logging: false,
});

// 连接数据库函数
function mysql(callback) {
    sequelize.authenticate()
        .then(() => {
            console.log('数据库连接成功 地址: http://127.0.0.1:3000');
            callback();
        })
        .catch((error) => {
            console.error('数据库连接失败:', error);
            process.exit(1);
        });
}

module.exports = {
    sequelize, // 导出 sequelize 实例
    mysql,   // 导出连接函数
};