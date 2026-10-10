/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const express = require('express');
var jwt = require('jsonwebtoken');
const redisService = require("../../../services/redisService")
const { Op } = require('sequelize');


const util = require("../../../utils/util");
const { User, Role, Dept } = require("../../../models/Summary")
const { secretJwt } = require("../../../config/index")

exports.login = async (req, res, next) => {
    let { account, userPwd, uuid, code } = req.body
    let verifyPwd = util.decrypt(userPwd)
    let user = await User.findOne({
        where: { account },
        include: [
            { model: Role, },
            { model: Dept, as: 'department', attributes: ['id', 'deptName'] }
        ]
    })
    if (!user) return res.json(util.fail("你未注册账号，或者账号不存在，请联系管理员"))
    if (util.decrypt(user.password) != verifyPwd) return res.json(util.fail("账户或密码输入错误"))

    const userData = user.toJSON();
    delete userData.password;
    // delete userData.phone:;

    const tokenPayload = {
        ...userData,
        id: userData.id,
        account: userData.account,
        username: userData.username,
        roleIds: userData.department.deptName
    };

    let redisToken = await redisService.getFun(`code_${uuid}`);

    if (!redisToken) {
        return res.json(util.fail("验证码已过期，请重新获取"))
    } else if (redisToken.toLowerCase() !== code.toLowerCase()) {
        return res.json(util.fail("验证码错误", "", 400))
    }

    let token = jwt.sign(tokenPayload, secretJwt.secret, { expiresIn: secretJwt.expiresIn });

    // 返回数据时同样避免循环引用
    res.json(util.success("登录成功", {
        token,
        userInfo: {
            ...userData,
            roleIds: userData.Roles ? userData.Roles.map(role => role.id) : [],
            createdAt: util.formatTime(userData.createdAt),
        },

    }))
}




