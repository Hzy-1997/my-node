/*
 * @Descripttion:
 * @version:
 * @Author: sueRimn
 * @Date: 2025-07-17 16:32:18
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-03-14 11:30:06
 */






module.exports = {
    // 密钥配置（从环境变量读取）
    secretKey: process.env.SECRET_KEY,
    secretJwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: "3h"
    },
    SESSION_ID: process.env.SESSION_SECRET,

    // 数据库配置（从环境变量读取）
    DBHOST: process.env.DB_HOST,
    DBPORT: process.env.DB_PORT,
    DBUSER: process.env.DB_USER,
    DBPASSWORD: process.env.DB_PASSWORD,
    DBNAME: process.env.DB_NAME,

    // 阿里云短信配置
    SMS_ACCESS_KEY_ID: process.env.ALI_SMS_ACCESS_KEY_ID,
    SMS_ACCESS_KEY_SECRET: process.env.ALI_SMS_ACCESS_KEY_SECRET,
    SMS_SIGN_NAME: process.env.ALI_SMS_SIGN_NAME,

    // 阿里云OSS配置
    ACCESS_KEY_ID: process.env.ALI_ACCESS_KEY_ID,
    ACCESS_KEY_SECRET: process.env.ALI_ACCESS_KEY_SECRET,
    OSS_REGION: process.env.ALI_OSS_REGION,
    BUCKET_NAME: process.env.ALI_BUCKET_NAME,

    // 微信小程序配置
    APP_ID: process.env.WX_APP_ID,
    ACCESS_SECRET: process.env.WX_SECRET,

    // 支付宝配置
    alipayPZ: {
        appId: process.env.ZFB_APP_ID,
        alipayPublicKey: process.env.ZFB_ALIPAY_PUBLIC_KEY,
        privateKey: process.env.ZFB_MERCHANT_PRIVATE_KEY,
        signType: 'RSA2',
        gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        encoding: 'utf8',
        timeout: 60000
    }
}