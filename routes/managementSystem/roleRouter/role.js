/*
 * @Descripttion:
 * @version:
 * @Author: sueRimn
 * @Date: 2025-07-25 14:23:12
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-03-30 14:34:42
 */

const util = require("../../../utils/util.js");
const { Op } = require("sequelize");
const { Role, Menu, User, Dept } = require("../../../models/Summary.js");

// 角色列表操作
exports.roleOperate = async (req, res) => {
    try {
        let { id, action, roleName, remark, status, permissions } = req.body;

        if (!action) return res.json(util.fail("无效操作，缺少必要参数"));

        if (action == "create") {
            if (!roleName) return res.json(util.fail("无效操作，缺少必要参数"));

            let nameState = await Role.findOne({ where: { roleName } });
            if (nameState) return res.json(util.fail("角色已存在"));

            // 创建角色
            let roleState = await Role.create(req.body);

            // 关联角色与菜单权限
            if (permissions && permissions.length > 0) {
                const menuIds = permissions.map((permission) =>
                    typeof permission === "object"
                        ? permission.menuId || permission.id
                        : permission
                );

                // 获取要添加的菜单
                const menusToAdd = await Menu.findAll({
                    where: {
                        id: menuIds,
                    },
                });
                await roleState.setMenus(menusToAdd);
            }

            if (roleState) return res.json(util.success("创建成功"));
        } else if (action == "update") {
            if (!req.body.id) return res.json(util.fail("缺少id"));
            // 更新角色信息
            const role = await Role.findByPk(id);

            if (!role) {
                return res.json({ success: false, message: "角色未找到" });
            }
            // 更新角色字段
            role.roleName = roleName || role.roleName;
            role.remark = remark || role.remark;
            role.status = status || role.status;
            await role.save();

            // 更新角色的菜单权限
            if (permissions && permissions.length > 0) {
                const menuIds = permissions.map((permission) =>
                    typeof permission === "object"
                        ? permission.menuId || permission.id
                        : permission
                );

                const menusToAdd = await Menu.findAll({
                    where: {
                        id: menuIds,
                    },
                });

                await role.setMenus(menusToAdd);
            } else if (permissions !== undefined) {
                // 如果permissions为空数组，清除所有关联的菜单权限
                await role.setMenus([]);
            }

            return res.json(util.success("更新成功"));
        } else if (action == "delete") {
            if (!id) return res.json(util.fail("缺少id"));
            // 判断是单个删除还是批量删除
            let ids = Array.isArray(id) ? [...id] : [id];

            // 批量删除
            try {
                // 遍历每个角色ID
                for (const roleId of ids) {
                    const role = await Role.findByPk(roleId);

                    if (role) {
                        // 先清除角色关联的菜单权限
                        await role.setMenus([]);
                        // 删除角色
                        await role.destroy();
                    }
                }
                return res.json(util.success(`成功删除${id.length}个角色`));
            } catch (error) {
                console.error("批量删除角色失败:", error);
                return res.json(util.fail("批量删除失败: " + (error.message || "未知错误")));
            }
        } else {
            return res.json(util.fail("未知操作类型"));
        }
    } catch (error) {
        console.error("角色操作失败:", error);
        return res.json(util.fail("操作失败: " + (error.message || "未知错误")));
    }
};

// 获取角色列表
exports.getRoleList = async (req, res) => {
    try {
        // 将pageNum和pageSize显式转换为数字类型
        const pageNum = parseInt(req.query.pageNum) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const sort = req.query.sort || "createdAt,DESC";
        const roleName = req.query.roleName || "";

        const { skipIndex, order } = util.pager(pageNum, pageSize, sort); // 分页

        const roles = await Role.findAndCountAll({
            limit: pageSize, // 每页数量
            offset: skipIndex, // 跳过索引
            where: {
                roleName: { [Op.like]: `%${roleName}%` },
            },
            order: order, // 排序
            include: [
                {
                    // 关联菜单表（权限）
                    model: Menu, // 关联模型
                    through: {
                        attributes: [], // 关联表字段
                    },
                    // attributes: ['id', 'menuName', 'menuLevel', 'type', 'permissionFlag'] // 只获取必要的菜单信息
                },
                {
                    // 关联用户表
                    model: User,
                    through: {
                        attributes: [], // 关联表字段
                    },

                    include: [
                        {
                            // 关联部门表
                            model: Dept,
                            as: "department",
                            attributes: ["id", "deptName"], // 只获取部门的id和名称
                        },
                    ],
                    attributes: ["id", "username"], // 只获取用户的id和用户名
                },
            ],
        });

        console.log("查询结果：", roles.rows)

        // 直接获取总条数
        const total = await Role.count();

        // 获取所有菜单（用于管理员角色）
        const allMenus = await Menu.findAll({ where: { status: 1 } });

        // 定义递归函数将平面菜单转换为树形结构
        const buildMenuTree = (menus, parentId = null) => {
            return menus.filter((menu) => menu.parentId === parentId).map((menu) => ({
                ...menu,
                // 提取权限信息到 permissions 字段，方便前端使用
                // permissions: util.formDate(menu.permissions),
                // 转换 createdAt 为格式化时间
                createdAt: util.formatTime(menu.createdAt),
                children: buildMenuTree(menus, menu.id),
            }));
        };

        function permissionIds(data) {
            const leafNodes = [];
            data.forEach((item) => {
                if (item.children && item.children.length > 0) {
                    leafNodes.push(...permissionIds(item.children));
                } else {
                    leafNodes.push(item.id);
                }
            });
            return leafNodes;
        }

        // 判断是否是管理员角色
        const isAdminRole = (roleName) => {
            return roleName === '管理员' || roleName === '超级管理员';
        };

        // 格式化数据，提取每个角色关联的部门信息和菜单权限
        const formattedRoles = util.formDate(roles.rows).map((role) => {
            // 如果是管理员角色，返回所有菜单
            if (isAdminRole(role.roleName)) {
                const adminMenus = allMenus.map(menu => menu.toJSON());
                return {
                    ...role,
                    menuList: buildMenuTree(adminMenus),
                    menuIds: permissionIds(buildMenuTree(adminMenus)),
                    Menus: undefined,
                    Users: undefined,
                };
            }

            // 普通角色，返回关联的菜单
            return {
                ...role,
                menuList: buildMenuTree(role.Menus),
                menuIds: permissionIds(buildMenuTree(role.Menus)),
                Menus: undefined,
                Users: undefined,
            };
        });

        return res.json(
            util.success("获取成功", {
                list: formattedRoles,
                totalItems: total,
                pageSize,
                currentPage: pageNum,
            })
        );
    } catch (error) {
        console.error("获取角色列表失败:", error);
        return res.json(util.fail("获取列表失败: " + (error.message || "未知错误")));
    }
};
