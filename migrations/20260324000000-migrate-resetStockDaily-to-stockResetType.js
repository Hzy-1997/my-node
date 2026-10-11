/*
 * @描述: 将resetStockDaily布尔字段迁移为stockResetType数字枚举字段
 * @版本: 
 * @作者: 
 * @日期: 2026-03-24
 * @最后编辑者: 
 * @最后编辑时间: 2026-03-24
 * 
 * 迁移说明：
 * - 原字段：resetStockDaily (BOOLEAN) - true表示每日重置，false表示不重置
 * - 新字段：stockResetType (INTEGER) - 0表示不重置（预售/总库存模式），1表示每日重置（日票模式）
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * 迁移步骤：
         * 1. 添加新字段 stockResetType
         * 2. 将原字段 resetStockDaily 的数据迁移到新字段
         * 3. 删除原字段 resetStockDaily
         */

        // 1. 添加新字段 stockResetType
        await queryInterface.addColumn('tickets', 'stockResetType', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '库存重置类型：0-不重置（预售/总库存模式），1-每日重置（日票模式）'
        });
        console.log('✅ 成功添加 stockResetType 字段');

        // 2. 数据迁移：将 resetStockDaily = true 的记录更新为 stockResetType = 1
        // 注意：这里假设原字段 resetStockDaily 存在
        try {
            // 获取所有包含 resetStockDaily 字段的记录
            const [results] = await queryInterface.sequelize.query(
                `SELECT id, resetStockDaily FROM tickets WHERE resetStockDaily IS NOT NULL`
            );
            
            if (results && results.length > 0) {
                console.log(`📝 开始迁移 ${results.length} 条记录...`);
                
                for (const record of results) {
                    const stockResetType = record.resetStockDaily === true || record.resetStockDaily === 1 ? 1 : 0;
                    await queryInterface.sequelize.query(
                        `UPDATE tickets SET stockResetType = ${stockResetType} WHERE id = ${record.id}`
                    );
                }
                console.log('✅ 数据迁移完成');
            } else {
                console.log('ℹ️ 没有需要迁移的数据');
            }
        } catch (error) {
            // 如果原字段不存在，跳过数据迁移
            console.log('ℹ️ 原字段 resetStockDaily 不存在或没有数据，跳过数据迁移');
        }

        // 3. 删除原字段 resetStockDaily（如果存在）
        try {
            await queryInterface.removeColumn('tickets', 'resetStockDaily');
            console.log('✅ 成功删除原字段 resetStockDaily');
        } catch (error) {
            console.log('ℹ️ 原字段 resetStockDaily 不存在，跳过删除');
        }

        console.log('✅ 迁移完成：resetStockDaily -> stockResetType');
    },

    async down(queryInterface, Sequelize) {
        /**
         * 回滚步骤：
         * 1. 添加原字段 resetStockDaily
         * 2. 将新字段 stockResetType 的数据迁移回原字段
         * 3. 删除新字段 stockResetType
         */

        // 1. 添加原字段 resetStockDaily
        await queryInterface.addColumn('tickets', 'resetStockDaily', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            comment: '是否每天重置库存（已废弃，请使用 stockResetType）'
        });
        console.log('✅ 成功添加原字段 resetStockDaily');

        // 2. 数据回滚：将 stockResetType = 1 的记录更新为 resetStockDaily = true
        await queryInterface.sequelize.query(
            `UPDATE tickets SET resetStockDaily = true WHERE stockResetType = 1`
        );
        await queryInterface.sequelize.query(
            `UPDATE tickets SET resetStockDaily = false WHERE stockResetType = 0`
        );
        console.log('✅ 数据回滚完成');

        // 3. 删除新字段 stockResetType
        await queryInterface.removeColumn('tickets', 'stockResetType');
        console.log('✅ 成功删除 stockResetType 字段');

        console.log('✅ 回滚完成：stockResetType -> resetStockDaily');
    }
};
