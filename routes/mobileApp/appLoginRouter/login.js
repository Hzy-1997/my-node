/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

// 小程序登录
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Sequelize, DataTypes } = require('sequelize');
var jwt = require('jsonwebtoken');
const util = require("../../../utils/util");
const axios = require('axios');

const redisService = require('../../../services/redisService');

const { APP_ID, ACCESS_SECRET, secretJwt } = require('../../../config/index.js');

// 引入模型
const { Member } = require('../../../models/memberModel/index'); // 引入模型

// 创建微信用户
exports.createMember = async (req, res) => {
    try {
        const { code, userName, avatar } = req.body;
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${ACCESS_SECRET}&js_code=${code}&grant_type=authorization_code`;
        let infor = await axios.get(url)

        // 检查微信返回是否有错误
        if (infor.data.errcode) {
            return res.json(util.fail(`微信登录失败: ${infor.data.errmsg}`));
        }

        const openid = infor.data.openid;

        const urltoken = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${ACCESS_SECRET}`
        const response = await axios.get(urltoken)

        // 查询用户是否已存在
        let user = await Member.findOne({
            where: {
                openld: openid
            }
        });

        let userInfo;
        if (user) {
            // 用户已存在，更新信息
            user.userName = userName || user.userName;
            user.avatar = avatar || user.avatar;
            await user.save();
            userInfo = user;
        } else {
            // 用户不存在，创建新用户
            let userPayload = {
                userName: userName,
                openld: openid,
                avatar: avatar,
            }
            userInfo = await Member.create(userPayload)
        }

        let tokenPayload = {
            id: userInfo.id,
            userName: userInfo.userName,
            openld: openid,
            avatar: userInfo.avatar,
        }
        let token = jwt.sign(tokenPayload, secretJwt.secret, { expiresIn: secretJwt.expiresIn });

        res.json(util.success("操作成功", {
            token: token,
            accessToken: response.data.access_token,
        }))
    } catch (error) {
        res.json(util.fail("操作失败"))
    }
}

// 手机号一键登录
exports.loginByPhone = async (req, res) => {
    try {
        const { code, encryptedData, iv } = req.body;

        // 1. 用code换取session_key和openid
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${ACCESS_SECRET}&js_code=${code}&grant_type=authorization_code`;
        let wxResult = await axios.get(url);

        // 检查微信返回是否有错误
        if (wxResult.data.errcode) {
            return res.json(util.fail(`微信登录失败: ${wxResult.data.errmsg}`));
        }

        const { session_key, openid } = wxResult.data;

        // 2. 解密手机号
        const phoneNumber = decryptPhoneNumber(encryptedData, session_key, iv);

        if (!phoneNumber) {
            return res.json(util.fail("手机号解密失败"));
        }

        // 3. 获取access_token（如果需要）
        const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${ACCESS_SECRET}`;
        const tokenResponse = await axios.get(tokenUrl);

        // 4. 查询或创建用户
        let user = await Member.findOne({
            where: {
                [Op.or]: [
                    { openld: openid },
                    { phone: phoneNumber }
                ]
            }
        });

        let userInfo;
        if (user) {
            // 更新用户的openid（如果之前没有）
            if (!user.openld) {
                user.openld = openid;
                await user.save();
            }
            userInfo = user;
        } else {
            // 创建新用户
            userInfo = await Member.create({
                userName: `用户_${phoneNumber.substr(-4)}`, // 默认昵称
                openld: openid,
                phone: phoneNumber, // 存储手机号
                avatar: '', // 可以后续让用户设置
            });
        }

        // 5. 生成JWT token
        let userPayload = {
            id: userInfo.id,
            openld: openid,
            phone: phoneNumber,
            userName: userInfo.userName
        };

        let token = jwt.sign(userPayload, secretJwt.secret, { expiresIn: secretJwt.expiresIn });

        // 6. 返回成功
        res.json(util.success("登录成功", {
            token: token,
            accessToken: tokenResponse.data.access_token,
            userInfo: {
                id: userInfo.id,
                phone: phoneNumber,
                userName: userInfo.userName,
                avatar: userInfo.avatar
            }
        }));

    } catch (error) {
        res.json(util.fail("操作失败"));
    }
};

// 解密手机号函数
function decryptPhoneNumber(encryptedData, sessionKey, iv) {
    try {
        // 将base64转换为Buffer
        const sessionKeyBuf = Buffer.from(sessionKey, 'base64');
        const encryptedDataBuf = Buffer.from(encryptedData, 'base64');
        const ivBuf = Buffer.from(iv, 'base64');

        // 创建解密器
        const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuf, ivBuf);
        decipher.setAutoPadding(true);

        // 解密
        let decoded = decipher.update(encryptedDataBuf, 'binary', 'utf8');
        decoded += decipher.final('utf8');

        // 解析JSON
        const decodedData = JSON.parse(decoded);

        // 返回手机号
        return decodedData.phoneNumber;
    } catch (error) {
        console.error('解密失败:', error);
        return null;
    }
}

// 获取微信用户信息
exports.getUserInfo = async (req, res) => {
    try {

        if (!req.headers.authorization) {
            return res.json(util.fail("未登录，请先登录"));
        }

        let token = req.headers.authorization.replace("Bearer ", "");
        if (!token) {
            return res.json(util.fail("登录信息无效，请重新登录"));
        }

        // 捕获 jwt 的验证错误，判断是否是过期的 token
        let userInfo;
        try {
            userInfo = jwt.verify(token, secretJwt.secret);
        } catch (error) {
            return res.json(util.fail("无效的登录信息，请重新登录"));
        }

        // 返回用户信息
        let data = await Member.findOne({
            where: {
                openld: userInfo.openld
            },
            attributes: {
                exclude: ['createdAt', 'updatedAt', 'backupField1', 'backupField2', 'backupField3']
            }
        });

        if (!data) {
            return res.json(util.fail("用户信息不存在"));
        }
        data.dataValues.phone = util.encrypt(data.dataValues.phone)
        data.dataValues.idCard = util.encrypt(data.dataValues.idCard)
        const str = util.encrypt(JSON.stringify(data))
        res.json(util.success("获取用户信息成功", str));
    } catch (error) {
        res.json(util.fail("操作失败", error));
    }
}

// 更新用户信息
exports.updateUserInfo = async function updateUserInfo(req, res) {
    const { id, openld } = req.body;

    try {

        if (!id) {
            return res.json(util.fail("缺少必要参数，更新失败！"));
        }

        let cachedData = await Member.findOne({
            where: { id: id },
        });

        if (!cachedData) {
            return res.json(util.fail("用户信息不存在"));
        }

        // 处理敏感信息

        if (req.body.phone) req.body.phone = util.decrypt(req.body.phone)
        if (req.body.idCard) req.body.idCard = util.decrypt(req.body.idCard)

        console.log("解密了吗？", req.body)

        // 更新用户信息
        await Member.update({
            ...req.body,
        }, {
            where: { id: id },
        });
        res.json(util.success("操作成功"));

    } catch (error) {
        res.json(util.fail("操作失败", error));
    }
}

// exports.getUserInfo = async (req, res) => {
//     try {
//         if (!req.headers.authorization) {
//             return res.json(util.fail("未登录，请先登录"));
//         }

//         let token = req.headers.authorization.replace("Bearer ", "");
//         if (!token) {
//             return res.json(util.fail("登录信息无效，请重新登录"));
//         }

//         let userInfo;
//         try {
//             userInfo = jwt.verify(token, secretJwt.secret);
//         } catch (error) {
//             return res.json(util.fail("无效的登录信息，请重新登录"));
//         }

//         // ========== 【新增】第 1 步：生成缓存 key ==========
//         const cacheKey = `user:info:${userInfo.openld}1`;

//         // ========== 【新增】第 2 步：尝试从 Redis 获取 ==========
//         let cachedData = await redisService.getFun(cacheKey);
//         if (cachedData) {
//             // 缓存命中，直接返回
//             console.log('用户信息从缓存获取');
//             return res.json(util.success("获取用户信息成功", cachedData));
//         }

//         console.log("是否走数据库查询");
//         // ========== 第 3 步：缓存未命中，查数据库 ==========
//         let data = await Member.findOne({
//             where: { openld: userInfo.openld },
//             attributes: {
//                 exclude: ['createdAt', 'updatedAt', 'backupField1', 'backupField2', 'backupField3']
//             }
//         });

//         if (!data) {
//             return res.json(util.fail("用户信息不存在"));
//         }

//         // 处理敏感信息
//         data.dataValues.phone = data.dataValues.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
//         data.dataValues.idCard = data.dataValues.idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');

//         // ========== 【新增】第 4 步：写入 Redis 缓存 ==========
//         // 缓存 30 分钟（1800秒），用户信息的变动不频繁
//         await redisService.setFun(cacheKey, data, 30);
//         console.log('用户信息已缓存');

//         const str = util.encrypt(JSON.stringify(data));
//         res.json(util.success("获取用户信息成功", str));

//     } catch (error) {
//         res.json(util.fail("操作失败", error));
//     }
// };


// 更新用户信息


// 
