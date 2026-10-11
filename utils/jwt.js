/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const jwt = require('jsonwebtoken');  // 引入jsonwebtoken模块
const { secretJwt } = require('../config/index.js');  // 密钥
const util = require("./util.js");
const { recordebug, recorderror, recordinfo } = require('./log4js.js'); // 引入封装的日志记录模块


// 验证Token
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretJwt.secret, (err, decoded) => {
            if (err) {
                let errorMsg = '';
                if (err.name === 'TokenExpiredError') {
                    errorMsg = "无效的会话，或者会话已过期，请重新登录。";
                } else if (err.name === 'JsonWebTokenError') {
                    errorMsg = "无效的会话，或者会话已过期，请重新登录。";
                }
                reject(new Error(errorMsg));
            } else {
                resolve(decoded);
            }
        });
    });
};

// 检测Token中间件
const checkToken = async (req, res, next) => {
    let token = req.headers['authorization'];

    if (token) {
        token = token.replace(/^Bearer\s+/i, '').trim();
    } else {
        recorderror('缺少Token', {
            path: req.originalUrl,
            method: req.method,
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
        return res.json(util.fail('Token认证失败', util.CODE.AUTH_ERROR));
    }

    try {
        const decoded = await verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        // 记录Token验证失败的日志
        recorderror('Token验证失败', {
            error: error.message,
            token: '***REDACTED***',
            path: req.originalUrl,
            method: req.method,
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
        return res.json(util.fail(error.message, "", util.CODE.AUTH_ERROR));
    }
};

// 记录请求日志
const logRequestMiddleware = async (req, res, next) => {
    try {
        // 获取用户信息
        const token = req.headers['authorization'];
        if (token) {
            const cleanedToken = token.replace(/^Bearer\s+/i, '').trim();
            const userinfo = await verifyToken(cleanedToken);
            const startTime = Date.now();
            const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const userId = userinfo ? userinfo.id : 'anonymous';
            const userName = userinfo ? userinfo.username : 'anonymous';
            req.user = userinfo;

            const logData = {
                userId,
                userName,
                ip,
                method: req.method,
                path: req.url,
                params: req.method === 'GET' ? req.query : req.body
            }

            res.on('finish', () => {
                const duration = Date.now() - startTime;
                logData.duration = `${duration}ms`
                logData.status = res.statusCode;

                if (res.statusCode === 200 || res.statusCode == 304) {
                    recordinfo(`请求结束, ${JSON.stringify(logData)}`);
                } else {
                    recorderror(`请求失败, ${JSON.stringify(logData)}`);
                }
            });
        } else {
            console.log('No Authorization header found');
        }
    } catch (error) {
        // Token 验证失败，记录日志但不阻断请求
        console.log('Token验证失败:', error.message);
    }
    next();

}


// 敏感信息过滤
const sanitizeData = (data) => {
    if (!data || typeof data !== 'object') return data;
    const sensitiveFields = ['userPwd', 'token', 'authorization', 'accessToken', 'refreshToken'];  // 定义需要过滤的敏感字段
    const sanitized = Array.isArray(data) ? [...data] : { ...data }; // 深拷贝数据

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';  // 将敏感信息替换为***
        }
    });
    return sanitized;
}


module.exports = {
    checkToken,
    verifyToken,
    logRequestMiddleware
}
