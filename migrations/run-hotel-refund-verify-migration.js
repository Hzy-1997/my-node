/**
 * 独立运行脚本：为酒店订单补全退款/核销相关字段
 * 用法：node migrations/run-hotel-refund-verify-migration.js
 *
 * 幂等：重复执行不会报错（列已存在则跳过）
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

async function addColumnIfNotExists(tableName, columnName, definition) {
    const exists = await columnExists(tableName, columnName);
    if (exists) {
        console.log(`[Migration] ${tableName}.${columnName} 已存在，跳过`);
        return;
    }
    await sequelize.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    console.log(`[Migration] ${tableName}.${columnName} 已添加`);
}

async function up() {
    try {
        console.log('[Migration] 开始执行酒店退款/核销字段迁移...');

        // 1. hotel_order 表
        await addColumnIfNotExists('hotel_order', 'alipayTradeNo',
            'VARCHAR(255) NULL COMMENT \'支付宝交易号（退款必需）\'');
        await addColumnIfNotExists('hotel_order', 'verifyStatus',
            'INT NULL DEFAULT 1 COMMENT \'核销状态：1-待核销,2-已核销,3-已取消\'');

        // 2. write_offs 表
        await addColumnIfNotExists('write_offs', 'type',
            'TINYINT NOT NULL DEFAULT 1 COMMENT \'核销员类型：1-票务,2-酒店\'');

        // 3. refund_orders 表
        await addColumnIfNotExists('refund_orders', 'orderType',
            'TINYINT NOT NULL DEFAULT 1 COMMENT \'订单类型：1-票务,2-套餐,3-酒店\'');

        console.log('[Migration] 迁移成功完成');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] 迁移失败:', error.message);
        process.exit(1);
    }
}

up();
