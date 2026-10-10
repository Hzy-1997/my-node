/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-22 10:06:50
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-04-07 11:28:06
 */


const express = require('express');
const util = require("../../../utils/util");

const { User, Role, Dept, Menu } = require("../../../models/Summary")
const { Op, } = require('sequelize');
const { body, validationResult } = require('express-validator');



// 操作用户接口
exports.register = [
    // 使用 express-validator 验证请求体
    body('account').if(body('action').equals('create')).notEmpty().isLength({ min: 3, max: 10 }).withMessage('用户名不能为空且长度应在3到10个字符之间'),
    body('username').notEmpty().withMessage('账号不能为空'),
    body('email').isEmail().withMessage('无效的邮箱地址'),
    body('phone').notEmpty().withMessage('手机号不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    body('deptId').optional().isInt().withMessage('部门ID必须是整数'),
    async (req, res) => {
        try {
            // 检查验证结果
            const errors = validationResult(req); //  验证请求参数是否符合规则
            if (!errors.isEmpty()) { //  如果验证错误不为空，说明参数验证失败
                return res.json(util.fail(errors.errors[0].msg));
            }

            const { id, action,
                account,
                username,
                email,
                phone,
                deptId, roleIds,
                oldPassword, password, confirmPassword } = req.body;

            if (!action) return res.json(util.fail('缺少操作类型参数'));

            if (action == 'create') {

                // 检查用户是否已经存在
                let nameCode = await User.findOne({ where: { username } });
                if (nameCode) {
                    return res.json(util.fail('用户名已存在'));
                }

                let accountCode = await User.findOne({ where: { account } });
                if (accountCode) {
                    return res.json(util.fail('账号已存在'));
                }

                let emailCode = await User.findOne({ where: { email } });
                if (emailCode) {
                    return res.json(util.fail('邮箱已存在'));
                }

                let phoneCode = await User.findOne({ where: { phone } });
                if (phoneCode) {
                    return res.json(util.fail('手机号已被注册'));
                }

                req.body.password = util.decrypt(password);
                const pattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&=+])[A-Za-z\d@$!%*?&=+]{6,20}$/;
                if (!pattern.test(req.body.password)) {
                    return res.json(util.fail('密码必须包含一个大写字母、一个小写字母、一个数字和一个特殊字符，长度在6到20之间'));
                }

                // 如果提供了部门ID，检查部门是否存在
                if (deptId) {
                    const dept = await Dept.findByPk(deptId);
                    if (!dept) {
                        return res.json(util.fail('指定的部门不存在'));
                    }
                }

                // 如果提供了角色ID列表，检查角色是否存在
                if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
                    const roles = await Role.findAll({
                        where: {
                            id: roleIds
                        }
                    });
                    if (roles.length !== roleIds.length) {
                        return res.json(util.fail('部分角色不存在'));
                    }

                    // 创建用户
                    const user = await User.create(req.body);

                    // 为用户分配角色
                    await user.setRoles(roles);
                } else {
                    return res.json(util.fail('请分配用户角色'));
                }

                return res.json(util.success('注册成功'));

            } else if (action == 'update') {
                const { id,
                    email,
                    phone,
                    deptId,
                    roleIds,
                    oldPassword, // 旧密码
                    confirmPassword, // 确认密码
                    password, } = req.body;

                if (!id) return res.json(util.fail('缺少完整信息'));

                // 检查用户是否存在
                let user = await User.findOne({ where: { id } });
                if (!user) return res.json(util.fail('用户不存在'));


                // 只检查与当前用户不匹配的邮箱和手机号
                if (email && email !== user.email) {
                    let emailCode = await User.findOne({ where: { email } });
                    if (emailCode) {
                        return res.json(util.fail('邮箱已被注册'));
                    }
                }
                if (phone && phone !== user.phone) {
                    let phoneCode = await User.findOne({ where: { phone } });
                    if (phoneCode) {
                        return res.json(util.fail('手机号已被注册'));
                    }
                }
                // 解密密码
                const decryptedPassword = util.decrypt(password);
                const decryptedOldPassword = util.decrypt(oldPassword);
                const decryptedConfirmPassword = util.decrypt(confirmPassword);

                if (decryptedOldPassword && decryptedPassword && decryptedConfirmPassword) {
                    // 验证密码规则
                    const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&=+])[A-Za-z\d@$!%*?&=+]{6,20}$/; // 密码规则：6-20位，包含字母、数字和特殊字符
                    if (!passwordPattern.test(decryptedPassword)) {
                        return res.json(util.fail('密码不符合规则，请输入6-20位，包含字母、数字和特殊字符的密码'));
                    }

                    // 验证旧密码
                    const decryptedUserPassword = util.decrypt(user.password);
                    if (decryptedUserPassword !== decryptedOldPassword) {
                        return res.json(util.fail("旧密码输入错误"));
                    }

                    // 验证两次新密码是否一致
                    if (decryptedPassword !== decryptedConfirmPassword) {
                        return res.json(util.fail("新密码两次密码输入不一致"));
                    }

                    // 更新密码时使用加密后的值（前端已经加密过）
                    req.body.password = password;

                } else {
                    delete req.body.password;
                }

                // 如果提供了部门ID，检查部门是否存在
                if (deptId) {
                    const dept = await Dept.findByPk(deptId);
                    if (!dept) return res.json(util.fail('指定的部门不存在'));
                }



                // 如果提供了角色ID列表，更新用户角色
                if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {

                    const roles = await Role.findAll({
                        where: {
                            id: roleIds
                        }
                    });
                    if (!roles || roles.length !== roleIds.length) return res.json(util.fail('指定的角色不存在'));
                    await user.setRoles(roles);

                } else {
                    // 空数组表示移除所有角色
                    await user.setRoles([]);
                }
                // 删除不需要的字段，避免更新
                delete req.body.oldPassword;
                delete req.body.confirmPassword;
                delete req.body.action;
                const state = await User.update(req.body, { where: { id } });
                return res.json(util.success('修改成功'));

            } else if (action == "delete") {
                let { id } = req.body;
                if (!id) return res.json(util.fail('请提供要删除的用户ID'));
                let ids = Array.isArray(id) ? [...id] : [id];

                // 定义where条件
                let whereCondition = {};
                whereCondition.id = ids;

                // 检查用户是否是部门负责人
                const leaderDepts = await Dept.findAll({
                    where: {
                        leaderId: whereCondition.id
                    },
                    attributes: ['id', 'deptName']
                });

                if (leaderDepts && leaderDepts.length > 0) {
                    const deptNames = leaderDepts.map(dept => dept.deptName).join('、');
                    return res.json(util.fail(`删除失败：用户是以下部门的负责人，请先更换部门负责人再删除用户：${deptNames}`));
                }

                // 用户角色关联取消
                if (ids.length > 0) {
                    for (const userId of ids) {
                        const role = await Role.findByPk(userId);
                        if (role) {
                            // 删除用户角色关联
                            await role.setUsers([]);
                        }
                    }
                }

                // 执行删除操作
                const deletedCount = await User.destroy({ where: whereCondition });
                if (deletedCount === 0) {
                    return res.json(util.fail('没有找到要删除的用户'));
                }

                return res.json(util.success(`成功删除了${deletedCount}个用户`));
            }
        } catch (error) {
            return res.json(util.fail('操作失败', error));
        }
    }
];

// 删除用户接口
exports.batchDelete = async (req, res) => {
    try {
        let { id } = req.body;
        if (!id) return res.json(util.fail('请提供要删除的用户ID'));
        let ids = Array.isArray(id) ? [...id] : [id];

        // 定义where条件
        let whereCondition = {};
        whereCondition.id = ids;

        // 检查用户是否是部门负责人
        const leaderDepts = await Dept.findAll({
            where: {
                leaderId: whereCondition.id
            },
            attributes: ['id', 'deptName']
        });

        if (leaderDepts && leaderDepts.length > 0) {
            const deptNames = leaderDepts.map(dept => dept.deptName).join('、');
            return res.json(util.fail(`删除失败：用户是以下部门的负责人，请先更换部门负责人再删除用户：${deptNames}`));
        }

        // 用户角色关联取消
        if (ids.length > 0) {
            for (const userId of ids) {
                const role = await Role.findByPk(userId);
                if (role) {
                    // 删除用户角色关联
                    await role.setUsers([]);
                }
            }
        }
        // 执行删除操作
        const deletedCount = await User.destroy({ where: whereCondition });
        if (deletedCount === 0) {
            return res.json(util.fail('没有找到要删除的用户'));
        }
        return res.json(util.success(`成功删除了${deletedCount}个用户`));

    } catch (error) {
        // 如果是外键约束错误，提供更友好的提示
        if (error.parent && error.parent.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.json(util.fail('删除失败：用户与其他数据存在关联，请先解除关联再删除'));
        }
        return res.json(util.fail('删除失败', error));
    }
};

// 获取用户列表接口
exports.list = async (req, res) => {
    try {
        // 解构查询参数并设置默认值
        const { pageNum = 1, pageSize = 10, username, phone } = req.query;

        // 参数验证和转换
        const numPageNum = Math.max(1, parseInt(pageNum) || 1);
        const numPageSize = Math.max(1, Math.min(100, parseInt(pageSize) || 10));

        // 构建查询条件对象
        const whereCondition = {};
        if (username) {
            whereCondition.username = {
                [Op.like]: `%${username}%`
            };
        }
        if (phone) {
            whereCondition.phone = {
                [Op.like]: `%${phone}%`
            };
        }

        // 查询用户数据（带分页和关联数据）
        const users = await User.findAndCountAll({
            offset: (numPageNum - 1) * numPageSize,
            limit: numPageSize,
            where: whereCondition,
            include: [
                {
                    model: Dept,
                    as: 'department',
                    attributes: ['id', 'deptName', 'leaderId', 'sort', 'status']
                },
                {
                    model: Role,
                    through: { attributes: [] },
                    attributes: ['id', 'roleName', 'remark', 'status', 'sort']
                }
            ],
            order: [['createdAt', 'DESC']] // 默认按创建时间降序
        });

        // 格式化用户数据
        const formattedUsers = users.rows.map(user => {
            const userData = user.toJSON();
            // 简化角色ID提取，添加空值检查
            const roleIds = Array.isArray(userData.Roles)
                ? userData.Roles.map(role => role.id)
                : [];

            return {
                ...userData,
                createdAt: util.formatTime(userData.createdAt),
                department: userData.department || null,
                roleIds // 存储角色ID数组
            };
        });

        // 返回标准化的响应数据
        return res.json(util.success('查询成功', {
            list: formattedUsers,
            total: users.count,
            page: numPageNum,
            pageSize: numPageSize
        }));
    } catch (error) {
        console.error('用户列表查询失败:', error); // 使用error级别日志
        return res.json(util.fail('查询失败，请稍后重试'));
    }
}

// 获取用户权限接口
exports.getUserPermissions = async (req, res) => {
    try {
        let { id } = req.query;
        if (!id) return res.json(util.fail('请提供要查询的用户ID'));
        // 查找用户及其关联的角色和菜单
        const user = await User.findByPk(id, {
            include: [{
                model: Role,
                through: { attributes: [] },
                include: [{
                    model: Menu,
                    through: { attributes: [] }
                }]
            }]
        });

        if (!user) return res.json(util.fail('用户不存在'));

        // 检查用户是否有关联角色
        if (!user.Roles || user.Roles.length === 0) {
            return res.json(util.fail('用户没有关联角色'));
        }

        console.log("user.Roles", user.Roles)

        // 判断是否是管理员（角色名称为"管理员"或"超级管理员"）
        const isAdmin = user.Roles.some(role =>
            role.roleName === '管理员' ||
            role.roleName === '超级管理员'
        );
        console.log("isAdmin", isAdmin)
        // 收集所有不重复的菜单
        const menuMap = new Map();
        const actionList = []; // 存储按钮权限标识

        // 如果是管理员，获取所有菜单
        if (isAdmin) {
            const allMenusFromDb = await Menu.findAll({
                where: { status: 1 }
            });
            console.log("获取菜单",)

            allMenusFromDb.forEach(menu => {
                const menuObj = menu.toJSON();
                if (menuObj.type === 3 && menuObj.permissionFlag) {
                    actionList.push(menuObj.permissionFlag);
                }
                menuMap.set(menu.id, menuObj);
            });
        } else {
            // 非管理员，遍历用户的所有角色获取菜单
            user.Roles.forEach(role => {
                if (role.Menus && role.Menus.length > 0) {
                    role.Menus.forEach(menu => {
                        if (menu && menu.id && !menuMap.has(menu.id)) {
                            // 去重
                            const menuObj = menu.toJSON ? menu.toJSON() : { ...menu };
                            if (menuObj.type === 3 && menuObj.permissionFlag) {
                                if (menuObj.status == 1) {
                                    actionList.push(menuObj.permissionFlag);
                                }
                            }
                            menuMap.set(menu.id, menuObj); // 将菜单对象存储到Map中
                        }
                    });
                }
            });
        }

        // 将Map转换为数组 构建树形结构
        const allMenus = Array.from(menuMap.values()).filter(item => item.status !== 2);
        const buildMenuTree = (menus, parentId = null) => {
            return menus
                .filter(menu => menu.parentId === parentId && menu.type !== 3) // 过滤掉按钮类型的菜单
                .sort((a, b) => (a.sort || 0) - (b.sort || 0)) // 按 sort 字段排序
                .map(menu => {
                    const children = buildMenuTree(menus, menu.id);
                    return {
                        id: menu.id,
                        menuName: menu.menuName,
                        menuLevel: menu.menuLevel,
                        path: menu.path,
                        icon: menu.icon,
                        component: menu.component,
                        type: menu.type,
                        permissionFlag: menu.permissionFlag,
                        sort: menu.sort,
                        children: children.length > 0 ? children : undefined
                    };
                });
        };

        // 生成树形菜单
        const menuList = buildMenuTree(allMenus).filter(item => item.children !== undefined);
        // 返回结果
        return res.json(util.success('查询成功', {
            userInfo: {
                id: user.id,
                userName: user.username,
            },
            menuList: menuList,
            actionList: actionList
        }));

    } catch (error) {
        console.log("获取用户权限失败:", error)
        return res.json(util.fail('查询失败', error.message || error));
    }
};

