/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

var svgCaptcha = require('svg-captcha');
const util = require("../../../utils/util");
const redisService = require("../../../services/redisService");
const crypto = require('crypto');
exports.verify = async (req, res) => {
    try {
        // 生成验证码规则
        let rules = {
            size: 5,                    // 验证码长度
            ignoreChars: '0O1Il9quv',   // 验证码字符中排除 0O1Il9quv
            noise: 5,                   // 干扰线条数量
            color: true,                // 是否有颜色，
            width: 180,                 // 宽
            height: 40,                  // 高  
        }
        // 变量环境
        const cryptoSecretKey = process.env.SECRET_KEY;
        const cryptoAlgorithm = process.env.CRYPTO_ALGORITHM;

        // var captcha = svgCaptcha.createMathExpr(rules); // 生成一个数字验证码
        var captcha = svgCaptcha.create(rules); // 生成一个字母数字混合的验证码

        req.session.captcha = captcha.text;
        // 生成UUID
        const uuid = crypto.randomUUID();
        let data = {
            img: captcha.data,
            uuid: uuid
        }
        // 存到redis中 60秒过期
        await redisService.setFun(`code_${data.uuid}`, captcha.text, 60);

        res.json(util.success("验证码生成成功", data));
    } catch (error) {
        res.json(util.fail("验证码生成失败,联系管理人员"))
    }
}

