
const util = require("../../../utils/util.js")
const { Menu } = require("../../../models/Summary.js")
const { Op } = require('sequelize');


// 菜单列表操作
exports.menuOperate = async (req, res) => {
    try {
        const { id, action, menuName, parentId, permissionFlag, path, icon, component, description, status, sort, ...params } = req.body;

        if (!action) {
            return res.json(util.fail('缺少必要参数'));
        }

        if (action === 'create') {


            // 检查菜单名称是否已存在
            if (req.body.menuLevel != 3) {
                // 对于非三级菜单，检查菜单名称是否已存在
                let nameMenu = await Menu.findOne({ where: { menuName } });
                if (nameMenu) return res.json(util.fail('菜单名称已存在'));
            } else {
                // 对于三级菜单（按钮权限），检查在同一父菜单下权限标识是否已存在
                if (parentId && permissionFlag) {
                    let permMenu = await Menu.findOne({
                        where: {
                            parentId,
                            permissionFlag,
                            menuLevel: 3
                        }
                    });
                    if (permMenu) return res.json(util.fail('当前菜单已存在此权限'));
                }
            }



            // 检查父菜单是否存在，如果传递了 parentId
            if (parentId) {
                let parentMenu = await Menu.findByPk(parentId);
                if (!parentMenu) {
                    return res.json(util.fail('上级菜单不存在'));
                }
                // 只有在创建子菜单（menuLevel=2）时才需要限制
                if (parentMenu.parentId && parentMenu.menuLevel == 2 && req.body.menuLevel != 3) {
                    return res.json(util.fail('父菜单是二级菜单，只能创建按钮类型的子项'));
                }
            }

            // 如果没有传递父菜单，说明是创建父菜单
            if (!parentId) {
                // 检查菜单标识是否已存在
                let menuState = await Menu.create({
                    ...req.body,
                    parentId: null // 没有父菜单
                });
                if (menuState) return res.json(util.success('菜单创建成功'));
            } else {
                // 如果传递了父菜单，创建子菜单
                if (req.body.menuLevel == 1) return res.json(util.fail('菜单级别选择错误'));

                let menuState = await Menu.create({
                    ...req.body,
                    parentId // 设置子菜单的父菜单ID
                });
                if (menuState) return res.json(util.success('子菜单创建成功'));
            }
        }
        else if (action === 'update') {
            if (!id) return res.json(util.fail('缺少必要参数'));
            let menuState = await Menu.findByPk(id);

            if (!menuState) return res.json(util.fail('更新失败'));

            // 更新时允许传入新的 parentId 进行父菜单更改
            if (parentId) {
                let parentMenu = await Menu.findByPk(parentId);

                // 先检查 parentMenu 是否存在
                if (!parentMenu) {
                    return res.json(util.fail('父菜单不存在'));
                }

                // 如果父菜单是二级菜单，只允许更新为按钮类型（menuLevel=3）
                if (parentMenu.menuLevel === 2 && req.body.menuLevel != 3) {
                    return res.json(util.fail('父菜单是二级菜单，只能创建按钮类型的子项'));
                }
            }

            // 更新菜单
            await Menu.update(req.body, { where: { id } });
            return res.json(util.success('更新成功'));
        }
        else if (action === 'delete') {
            if (!id) return res.json(util.fail('缺少必要参数'));
            let menuState = await Menu.findByPk(id);
            if (!menuState) return res.json(util.fail('删除失败'));
            await Menu.destroy({ where: { id } });
            return res.json(util.success('删除成功'));
        }
        // else if (action === 'purview') {
        //     // 为菜单分配权限
        //     const { menuId, permissionCode, description, action } = req.body;

        //     if (!menuId || !permissionCode || !description || !action) {
        //         return res.json(util.fail('缺少必要参数'));
        //     }

        //     // 检查菜单是否存在
        //     let menu = await Menu.findByPk(menuId);
        //     if (!menu) return res.json(util.fail('菜单不存在'));

        //     // 创建权限记录
        //     let permissionState = await MenuPermission.create({
        //         parentId,
        //         MenuPermissionCode: permissionCode,
        //         description,
        //         action
        //     });

        //     if (permissionState) return res.json(util.success('权限分配成功'));
        //     return res.json(util.fail('权限分配失败'));
        // }
    } catch (error) {
        return res.json(util.fail(error));
    }
}


// 获取菜单列表
exports.menuList = async (req, res) => {
    try {
        let { menuName } = req.query;

        // 定义查询条件
        let where = {};
        if (menuName) {
            // 如果传递了menuName，进行模糊查询
            where.menuName = { [Op.like]: `%${menuName}%` };
        }

        let data = await Menu.findAndCountAll({
            where,   // 根据条件进行查询
            include: [{ // 关联查询
                model: Menu, // 关联Menu模型
                as: 'parentMenu', // 关联表的别名
                foreignKey: 'parentId',  // 关联表的字段名
                // attributes: ['id', 'menuName'] // 关联表的字段
            }]
        });

        // 定义递归函数将平面菜单转换为树形结构
        const buildMenuTree = (menus, parentId = null) => {
            return menus.filter(menu => menu.parentId === parentId) // 过滤出父级菜单
                .sort((a, b) => (a.sort || 0) - (b.sort || 0)) // 按 sort 字段排序
                .map(menu => ({
                    ...menu.toJSON(),
                    // 提取权限信息到 permissions 字段，方便前端使用
                    // permissions: util.formDate(menu.permissions),
                    // 转换 createdAt 为格式化时间
                    createdAt: util.formatTime(menu.createdAt),
                    children: buildMenuTree(menus, menu.id)
                }));
        };

        // 如果有搜索条件，直接返回所有匹配的菜单，不构建树形结构
        const menuTree = menuName ? data.rows.map(menu => ({
            ...menu.toJSON(),
            createdAt: util.formatTime(menu.createdAt)
        })) : buildMenuTree(data.rows);

        if (!data) return res.json(util.fail('获取失败'));
        return res.json(util.success("获取成功", menuTree))

    } catch (error) {
        return res.json(util.fail(error));
    }
}

// 菜单权限
exports.menuPermissionOperate = async (req, res) => {
    try {
        const { id, action, parentId, permissionCode, description, ...params } = req.body;

        if (!action) {
            return res.json(util.fail('缺少必要参数'));
        }

        if (action == 'create') {
            // 检查菜单是否存在
            let menu = await Menu.findByPk(parentId);
            if (!menu) return res.json(util.fail('菜单不存在'));

            // 检查权限代码是否已存在
            let existingPermission = await Permission.findOne({ where: { permissionCode: permissionCode } });
            if (existingPermission) return res.json(util.fail('权限代码已存在'));

            // 如果是子菜单，检查父菜单是否存在
            if (menu.parentId) {
                let parentMenu = await Menu.findByPk(menu.parentId);
                if (!parentMenu) {
                    return res.json(util.fail('父菜单不存在'));
                }
                // 如果父菜单有权限，继承父菜单权限
                let parentPermissions = await Permission.findAll({ where: { parentId: parentMenu.id } });
                if (parentPermissions.length > 0) {
                    // 继承父菜单的权限
                    await Permission.create({
                        ...req.body,
                        parentId: menu.id,  // 设置为当前菜单ID
                        permissionCode,
                        permissionName: description || '继承自父菜单'
                    });
                    return res.json(util.success('子菜单权限创建成功，并继承自父菜单'));
                }
            }

            // 创建子菜单独立权限
            await Permission.create({
                ...req.body,
                parentId: menu.id,  // 设置为当前菜单ID
                permissionCode,
                permissionName: description || '独立权限'
            });
            return res.json(util.success('子菜单独立权限创建成功'));

        } else if (action == 'update') {
            if (!id) return res.json(util.fail('缺少必要参数'));

            let permission = await Permission.findByPk(id);
            if (!permission) return res.json(util.fail('更新失败，权限不存在'));

            // 更新时允许修改权限描述或权限代码
            await Permission.update(req.body, { where: { id } });
            return res.json(util.success('权限更新成功'));

        } else if (action == 'delete') {
            if (!id) return res.json(util.fail('缺少必要参数'));

            let permission = await Permission.findByPk(id);
            if (!permission) return res.json(util.fail('删除失败，权限不存在'));

            // 删除前检查该权限是否被子菜单使用
            let childMenus = await Menu.findAll({ where: { parentId: permission.parentId } });

            // 确保permissionCode存在
            if (!permission.permissionCode) {
                console.error('Permission code is undefined');
                return res.json(util.fail('权限代码不存在，无法删除'));
            }

            // 使用Promise.all和map正确处理异步检查
            let permissionChecks = childMenus.map(menu =>
                Permission.findOne({ where: { parentId: menu.id, permissionCode: permission.permissionCode } })
            );

            let checkResults = await Promise.all(permissionChecks);
            let usedByChildMenus = checkResults.some(result => result !== null);

            if (usedByChildMenus) {
                return res.json(util.fail('该权限被子菜单使用，无法删除'));
            }

            await Permission.destroy({ where: { id } });
            return res.json(util.success('权限删除成功'));
        }
    } catch (error) {
        return res.json(util.fail(error));

    }
};



// 获取权限列表
exports.getPermissionList = async (req, res) => {
    try {
        let { parentId } = req.query;
        if (!parentId) return res.json(util.fail('缺少必要参数'));

        let permissions = await Permission.findAll({ where: { parentId } });
        return res.json(util.success('获取权限列表成功', permissions));

    } catch (error) {
        return res.json(util.fail(error));
    }
}

// 获取所有菜单的所有权限列表（用于全局权限控制）
exports.getAllMenuPermissions = async (req, res) => {
    try {
        // 查询所有菜单权限，并关联菜单信息 
        let allPermissions = await Permission.findAll({
            include: [{
                model: Menu,
                as: 'menu',
                attributes: ['menuName', 'path']
            }],
            attributes: ['permissionCode', 'permissionName']
        });

        // 格式化为权限代码为key的对象，方便前端快速查找
        const permissionMap = {};
        allPermissions.forEach(permission => {
            permissionMap[permission.permissionCode] = {
                name: permission.permissionName,
                menuName: permission.menu?.menuName || '',
                menuPath: permission.menu?.path || ''
            };
        });

        return res.json(util.success('获取所有菜单权限成功', permissionMap));
    } catch (error) {
        return res.json(util.fail(error));
    }
}