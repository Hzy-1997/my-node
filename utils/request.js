/*
 * @Descripttion: 第三方请求封装工具
 * @version: 1.0.0
 * @Author: sueRimn
 * @Date: 2025-12-19 10:00:00
 * @LastEditors: sueRimn
 * @LastEditTime: 2025-12-19 10:00:00
 */

const axios = require('axios');
const { recorderror, recordinfo } = require('./log4js.js');

class RequestUtil {
    constructor() {
        this.defaultConfig = {
            timeout: 10000, // 默认10秒超时
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js Request Util/1.0.0'
            }
        };
    }

    /**
     * 创建请求实例
     * @param {Object} config - 请求配置
     * @returns {Object} axios实例
     */
    createInstance(config = {}) {
        const instanceConfig = {
            ...this.defaultConfig,
            ...config
        };

        const instance = axios.create(instanceConfig);

        // 请求拦截器
        instance.interceptors.request.use(
            (config) => {
                recordinfo(`[Request] ${config.method?.toUpperCase()} ${config.url}`);
                if (config.data) {
                    recordinfo(`[Request Data] ${JSON.stringify(config.data)}`);
                }
                if (config.params) {
                    recordinfo(`[Request Params] ${JSON.stringify(config.params)}`);
                }
                return config;
            },
            (error) => {
                recorderror(`[Request Error] ${error.message}`);
                return Promise.reject(error);
            }
        );

        // 响应拦截器
        instance.interceptors.response.use(
            (response) => {
                recordinfo(`[Response] ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                recorderror(`[Response Error] ${error.message}`);
                if (error.response) {
                    recorderror(`[Response Error Details] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
                }
                return Promise.reject(error);
            }
        );

        return instance;
    }

    /**
     * GET请求
     * @param {string} url - 请求URL
     * @param {Object} params - 查询参数
     * @param {Object} config - 额外配置
     * @returns {Promise} 请求结果
     */
    async get(url, params = {}, config = {}) {
        try {
            const instance = this.createInstance(config);
            const response = await instance.get(url, { params, ...config });
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * POST请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     * @param {Object} config - 额外配置
     * @returns {Promise} 请求结果
     */
    async post(url, data = {}, config = {}) {
        try {
            const instance = this.createInstance(config);
            const response = await instance.post(url, data, config);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * PUT请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     * @param {Object} config - 额外配置
     * @returns {Promise} 请求结果
     */
    async put(url, data = {}, config = {}) {
        try {
            const instance = this.createInstance(config);
            const response = await instance.put(url, data, config);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * DELETE请求
     * @param {string} url - 请求URL
     * @param {Object} config - 额外配置
     * @returns {Promise} 请求结果
     */
    async delete(url, config = {}) {
        try {
            const instance = this.createInstance(config);
            const response = await instance.delete(url, config);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * 处理响应数据
     * @param {Object} response - axios响应对象
     * @returns {Object} 标准化响应
     */
    handleResponse(response) {
        return {
            success: true,
            status: response.status,
            data: response.data,
            headers: response.headers,
            config: response.config
        };
    }

    /**
     * 处理错误
     * @param {Object} error - 错误对象
     * @returns {Object} 标准化错误响应
     */
    handleError(error) {
        if (error.response) {
            // 服务器返回了错误状态码
            return {
                success: false,
                status: error.response.status,
                message: error.response.statusText,
                data: error.response.data,
                error: error.message
            };
        } else if (error.request) {
            // 请求已发送但没有收到响应
            return {
                success: false,
                status: 0,
                message: '网络错误，请检查网络连接',
                error: error.message
            };
        } else {
            // 请求配置错误
            return {
                success: false,
                status: -1,
                message: '请求配置错误',
                error: error.message
            };
        }
    }

    /**
     * 设置默认配置
     * @param {Object} config - 配置对象
     */
    setDefaultConfig(config) {
        this.defaultConfig = {
            ...this.defaultConfig,
            ...config
        };
    }

    /**
     * 文件上传请求
     * @param {string} url - 请求URL
     * @param {FormData} formData - FormData对象
     * @param {Object} config - 额外配置
     * @returns {Promise} 请求结果
     */
    async upload(url, formData, config = {}) {
        try {
            const uploadConfig = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...config.headers
                },
                ...config
            };

            const instance = this.createInstance(uploadConfig);
            const response = await instance.post(url, formData, uploadConfig);
            return this.handleResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * 并发请求
     * @param {Array} requests - 请求数组
     * @returns {Promise} 所有请求的结果
     */
    async all(requests) {
        try {
            const results = await Promise.all(requests);
            return {
                success: true,
                results: results.map(result => this.handleResponse(result))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 创建默认实例
const requestUtil = new RequestUtil();

// 导出默认实例和类
module.exports = {
    RequestUtil,
    get: (url, params, config) => requestUtil.get(url, params, config),
    post: (url, data, config) => requestUtil.post(url, data, config),
    put: (url, data, config) => requestUtil.put(url, data, config),
    delete: (url, config) => requestUtil.delete(url, config),
    upload: (url, formData, config) => requestUtil.upload(url, formData, config),
    all: (requests) => requestUtil.all(requests),
    setDefaultConfig: (config) => requestUtil.setDefaultConfig(config)
};