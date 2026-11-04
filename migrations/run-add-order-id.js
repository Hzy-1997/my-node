/**
 * 独立运行脚本：为 orders 表新增自增主键 id，orderNumber 降级为唯一索引
 * 用法：node migrations/run-add-order-id.js
 *
 * 做的事：
 *   1. orders 表新增 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
 *      （已有数据 MySQL 会自动按顺序补上编号，无需手工回填）
 *   2. 原主键 orderNumber 改为唯一索引 idx_order_number（保持业务唯一性）
 *
 * 幂等：重复执行不会报错（id 列已存在则跳过）
 *
 * 注意：执行前建议先备份数据库
 */
const { sequelize } = require('../mysql/index');

async function columnExists(tableName, columnName) {
    const [rows] = await sequelize.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        { replacements: [tableName, columnName] }
    );
    return rows[0].cnt > 0;
}

async function indexExists(tableName, indexName) {
    const [rows] = await sequelize.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
        { replacements: [tableName, indexName] }
    );
    return rows[0].cnt > 0;
}

async function up() {
    try {
        if (await columnExists('orders', 'id')) {
            console.log('[Migration] orders.id 已存在，跳过');
            return;
        }

        console.log('[Migration] 开始为 orders 表新增自增 id ...');

        // 关闭外键检查，避免子表外键（如 refund_orders）阻止删改主键
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // 若旧的非唯一索引 idx_order_number 已存在则先删除，后面用同名唯一索引替代
        if (await indexExists('orders', 'idx_order_number')) {
            await sequelize.query('ALTER TABLE `orders` DROP INDEX `idx_order_number`');
            console.log('[Migration] 已删除旧索引 idx_order_number');
        }

        // 一条 ALTER 原子完成：
        //   撤掉 orderNumber 主键 → 新增自增 id 主键 → orderNumber 补唯一索引
        await sequelize.query(
            `ALTER TABLE \`orders\`
             DROP PRIMARY KEY,
             ADD COLUMN \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
             ADD UNIQUE KEY \`idx_order_number\` (\`orderNumber\`)`
        );

        console.log('[Migration] orders.id 新增完成，已有数据已自动编号');
    } catch (error) {
        console.error('[Migration] 执行失败:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        await sequelize.close();
    }
}

up();
