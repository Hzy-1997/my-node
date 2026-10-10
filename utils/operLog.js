/*
 * @描述: 操作日志工具类
 * @版本: 
 * @作者: 
 * @日期: 2026-03-28
 */

const { OperLog } = require('../models/Summary');
const util = require("./util.js");
const { verifyToken } = require("./jwt.js")

/**
 * 获取客户端IP地址
 */
const getClientIp = (req) => {
    return req.ip ||
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        'unknown';
};

/**
 * 获取请求参数
 */
const getRequestParams = (req) => {
    // 合并所有参数源
    const params = {
        ...req.query,
        ...req.body,
        ...req.params
    };

    // 过滤敏感字段
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const filteredParams = {};

    for (const [key, value] of Object.entries(params)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            filteredParams[key] = '***';
        } else {
            filteredParams[key] = value;
        }
    }

    return JSON.stringify(filteredParams);
};

/**
 * 记录操作日志
 * @param {Object} options - 日志选项
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {number} startTime - 开始时间戳
 */
const recordOperLog = async (options, req, res, startTime) => {
    try {
        const costTime = Date.now() - startTime;
        const token = req.headers['authorization'];
        if (!token) {
            console.log('未找到token')
        }

        // 获取用户信息（从token中解析）
        let operatorName = '未知用户';
        let operatorType = '未知类型';
        let deptName = '';


        if (req.user) {
            operatorName = req.user.username || req.user.account || '未知用户';
            operatorType = req.user.job || '普通用户';
            deptName = req.user.department.deptName || '未知部门';
        }

        const logData = {
            title: options.title || '未知操作',
            businessType: options.businessType || '其他',
            method: options.method || req.route?.path || req.path,
            requestMethod: req.method,
            operatorType: operatorType,
            operatorName: operatorName,
            deptName: deptName,
            operUrl: req.originalUrl,
            operIp: getClientIp(req),
            operLocation: '', // 可以通过IP查询地理位置
            operParam: getRequestParams(req),
            jsonResult: options.result ? JSON.stringify(options.result).substring(0, 2000) : '',
            status: options.status !== undefined ? options.status : 0,
            errorMsg: options.errorMsg || '',
            operTime: new Date(),
            costTime: costTime
        };

        // 异步记录日志，不阻塞主流程
        OperLog.create(logData).catch(err => {
            console.error('记录操作日志失败:', err);
        });

    } catch (error) {
        console.error('操作日志记录异常:', error);
    }
};

/**
 * 操作日志中间件
 * 用法: router.post('/path', operLogMiddleware({ title: '新增用户', businessType: '新增' }), handler)
 */
const operLogMiddleware = (options = {}) => {
    return async (req, res, next) => {
        const startTime = Date.now();

        // 保存原始的res.json方法
        const originalJson = res.json.bind(res);

        // 重写res.json方法以捕获响应结果
        res.json = function (data) {
            // 恢复原始方法
            res.json = originalJson;

            // 判断操作状态
            let status = 0;
            let errorMsg = '';

            if (data && typeof data === 'object') {
                // 根据你的util.success/util.fail格式判断
                if (data.code !== 200 && data.code !== 0) {
                    status = 1;
                    errorMsg = data.message || data.msg || '操作失败';
                }
            }

            // 记录日志
            recordOperLog({
                ...options,
                status,
                errorMsg,
                result: data
            }, req, res, startTime);

            // 调用原始方法返回响应
            return originalJson(data);
        };

        next();
    };
};

/**
 * 手动记录操作日志
 * 用法: await manualOperLog({ title: '自定义操作' }, req, { code: 200, message: '成功' })
 */
const manualOperLog = async (options, req, result) => {
    const startTime = Date.now() - (options.costTime || 0);

    let status = 0;
    let errorMsg = '';

    if (result && typeof result === 'object') {
        if (result.code !== 200 && result.code !== 0) {
            status = 1;
            errorMsg = result.message || result.msg || '操作失败';
        }
    }

    await recordOperLog({
        ...options,
        status,
        errorMsg,
        result
    }, req, null, startTime);
};

module.exports = {
    operLogMiddleware,
    manualOperLog,
    recordOperLog
};
