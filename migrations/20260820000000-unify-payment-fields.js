/*
 * @描述: 统一各业务订单表的支付字段名为 orderNumber / title / orderAmount
 *        目的：让 publicInterface.js 的 payment 接口可以无差别处理 4 个业务表
 *
 *        1. hotel_order:        旧 roomName → title（model 已有 title）
 *                              旧 amount   → orderAmount（model 已有 orderAmount）
 *        2. parking_reservation:旧 price    → orderAmount（model 已有 orderAmount）
 *                              旧 orderNo  → orderNumber（注意 orderNo 不是 JS 变量而是 DB 列名）
 *        3. package_order_details:旧 itemName → title（仅数据回填，保留 itemName 列）
 *
 *        注：model 已通过 sequelize.sync({alter:true}) 自动加上新列，
 *            本迁移只负责把旧列的数据搬到新列，然后删除旧列（避免脏数据残留）
 * @日期: 2026-08-20
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 通用：列是否存在
        async function colExists(tableName, columnName) {
            const [rows] = await queryInterface.sequelize.query(
                `SELECT COUNT(*) AS cnt FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
                { replacements: [tableName, columnName] }
            );
            return rows[0].cnt > 0;
        }

        // 通用：旧列数据搬到新列（仅在新列为空时搬）
        async function migrateColumn(tableName, oldCol, newCol) {
            const oldExists = await colExists(tableName, oldCol);
            const newExists = await colExists(tableName, newCol);
            if (!oldExists) {
                console.log(`[Migration] ${tableName}.${oldCol} 不存在，跳过`);
                return;
            }
            if (!newExists) {
                console.log(`[Migration] ${tableName}.${newCol} 不存在，请先 sync 模型！跳过`);
                return;
            }
            // 数据回填：仅当新列 IS NULL 时拷贝旧列值，避免覆盖新数据
            await queryInterface.sequelize.query(
                `UPDATE \`${tableName}\` SET \`${newCol}\` = \`${oldCol}\` WHERE \`${newCol}\` IS NULL AND \`${oldCol}\` IS NOT NULL`
            );
            console.log(`[Migration] ${tableName}: ${oldCol} → ${newCol} 数据已回填`);
            // 删除旧列
            try {
                await queryInterface.removeColumn(tableName, oldCol);
                console.log(`[Migration] ${tableName}.${oldCol} 旧列已删除`);
            } catch (e) {
                console.log(`[Migration] ${tableName}.${oldCol} 删除失败（可能已被外键依赖）:`, e.message);
            }
        }

        // === 1. hotel_order ===
        // 1.1 roomName → title
        await migrateColumn('hotel_order', 'roomName', 'title');
        // 1.2 amount → orderAmount
        await migrateColumn('hotel_order', 'amount', 'orderAmount');

        // === 2. parking_reservation ===
        // 2.1 price → orderAmount
        await migrateColumn('parking_reservation', 'price', 'orderAmount');
        // 2.2 orderNo → orderNumber（注意：orderNo 是 DB 列名，不是 JS 变量）
        //     检查 orderNo 和 orderNumber 是否同时存在，只有 orderNo 单独存在时才迁移
        const parkingHasOrderNo = await colExists('parking_reservation', 'orderNo');
        const parkingHasOrderNumber = await colExists('parking_reservation', 'orderNumber');
        if (parkingHasOrderNo && !parkingHasOrderNumber) {
            // 直接 rename
            try {
                await queryInterface.renameColumn('parking_reservation', 'orderNo', 'orderNumber');
                console.log('[Migration] parking_reservation.orderNo → orderNumber 重命名完成');
            } catch (e) {
                console.log('[Migration] parking_reservation renameColumn 失败:', e.message);
            }
        } else if (parkingHasOrderNo && parkingHasOrderNumber) {
            // 两列都有，走通用迁移
            await migrateColumn('parking_reservation', 'orderNo', 'orderNumber');
        } else {
            console.log('[Migration] parking_reservation.orderNo 不存在，跳过');
        }

        // === 3. package_order_details ===
        // 3.1 仅数据回填 itemName → title（保留 itemName 列，因为代码仍引用）
        const pkgHasItemName = await colExists('package_order_details', 'itemName');
        const pkgHasTitle = await colExists('package_order_details', 'title');
        if (pkgHasItemName && pkgHasTitle) {
            // package_order_details 用了 underscored:true，DB 列名是 item_name 和 title
            // 但 Sequelize 在 information_schema 里查的是实际 DB 列名
            // 这里直接用 DB 实际列名 item_name
            const [cols] = await queryInterface.sequelize.query(
                `SELECT column_name FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = 'package_order_details'
                 AND column_name IN ('itemName', 'item_name', 'title')`
            );
            const colNames = cols.map(c => c.COLUMN_NAME || c.column_name);
            const realItemName = colNames.includes('item_name') ? 'item_name' : (colNames.includes('itemName') ? 'itemName' : null);
            if (realItemName) {
                await queryInterface.sequelize.query(
                    `UPDATE \`package_order_details\` SET \`title\` = \`${realItemName}\` WHERE \`title\` IS NULL AND \`${realItemName}\` IS NOT NULL`
                );
                console.log(`[Migration] package_order_details: ${realItemName} → title 数据已回填（保留 ${realItemName} 列）`);
            }
        } else {
            console.log('[Migration] package_order_details 无需回填 title');
        }
    },

    async down(queryInterface, Sequelize) {
        // 回滚：重新加回旧列（数据不可逆，仅恢复结构）
        try { await queryInterface.addColumn('hotel_order', 'roomName', { type: Sequelize.STRING, allowNull: true }); } catch (e) {}
        try { await queryInterface.addColumn('hotel_order', 'amount', { type: Sequelize.DECIMAL(10, 2), allowNull: true }); } catch (e) {}
        try { await queryInterface.addColumn('parking_reservation', 'price', { type: Sequelize.FLOAT, allowNull: true }); } catch (e) {}
        try { await queryInterface.addColumn('parking_reservation', 'orderNo', { type: Sequelize.STRING(50), allowNull: true }); } catch (e) {}
    }
};
