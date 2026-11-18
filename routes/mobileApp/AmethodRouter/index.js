/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const axios = require('axios');
const { APP_ID, ACCESS_SECRET, } = require('../../../config/index.js');
const redisService = require('../../../services/redisService');

let tokenPromise = null;

const getWxAccessToken = async () => {
    const cacheKey = `accessToken:wx:${APP_ID}`;

    // 1. 先查缓存
    const cached = await redisService.getFun(cacheKey);
    if (cached) return cached;

    // 2. 如果已经有请求在获取 token，直接等它，不要再发一次
    if (tokenPromise) return tokenPromise;

    // 3. 第一个进来的请求，负责去获取 token
    tokenPromise = (async () => {
        try {
            const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${ACCESS_SECRET}`;
            const { data } = await axios.get(url);
            if (!data.access_token) {
                throw new Error(`获取 token 失败: ${data.errmsg}`);
            }

            if (!data || !data.access_token) {
                throw new Error("获取微信access_token失败，返回数据异常");
            }
            // 2. 计算安全过期时间（默认按微信返回的时间减去200秒，最少缓存60秒） 
            const expiresIn = Number(data.expires_in);
            const expireTime = Math.max(expiresIn - 200, 60);

            await redisService.setFun(cacheKey, data.access_token, expireTime); // 缓存 120 分钟
            return data.access_token;
        } finally {
            // 无论成功失败，都要清空，让下次能重新获取
            tokenPromise = null;
        }
    })();

    return tokenPromise;
};



module.exports = {
    getWxAccessToken,
};