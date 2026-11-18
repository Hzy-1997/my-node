const { sequelize } = require('./mysql/index');

(async () => {
    const t = await sequelize.transaction();
    try {
        // 防重复插入
        const [exist] = await sequelize.query("SELECT id FROM menus WHERE menuName = '演艺管理'", { transaction: t });
        if (exist.length) {
            console.log('菜单已存在，跳过插入，一级菜单id:', exist[0].id);
            await t.rollback();
            return;
        }

        // 一级目录菜单
        const [r1] = await sequelize.query(
            `INSERT INTO menus (menuName, menuLevel, path, icon, component, description, status, sort, parentId, type, permissionFlag, createdAt, updatedAt)
             VALUES ('演艺管理', 1, 'performance', 'star', '', '景区演艺演出管理', 1, 2, NULL, 1, '', NOW(), NOW())`,
            { transaction: t }
        );
        const parentId = r1;

        // 二级页面菜单
        const [r2] = await sequelize.query(
            `INSERT INTO menus (menuName, menuLevel, path, icon, component, description, status, sort, parentId, type, permissionFlag, createdAt, updatedAt)
             VALUES ('演出场次管理', 2, 'performanceSchedule', '', 'performance/performanceSchedule', '按星期维护演出场次排布', 1, 1, ?, 2, '', NOW(), NOW())`,
            { replacements: [parentId], transaction: t }
        );

        // 绑定到全部角色（后端开发9、管理员25）
        const [roles] = await sequelize.query("SELECT id FROM roles", { transaction: t });
        for (const role of roles) {
            await sequelize.query(
                "INSERT INTO menu_roles (MenuId, RoleId) VALUES (?, ?), (?, ?)",
                { replacements: [parentId, role.id, r2, role.id], transaction: t }
            );
        }

        await t.commit();
        console.log(`菜单插入成功：一级id=${parentId}，二级id=${r2}，已绑定${roles.length}个角色`);
    } catch (e) {
        await t.rollback();
        console.error('插入失败:', e.message);
    } finally {
        await sequelize.close();
    }
})();
