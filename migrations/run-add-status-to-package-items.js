/**
 * 独立运行脚本：为 package_items 表新增 status 字段
 * 用法：node migrations/run-add-status-to-package-items.js
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
        console.log('[Migration] 开始执行 package_items.status 字段迁移...');

        // package_items 表新增 status 字段（状态：1=正常 2=删除）
        await addColumnIfNotExists('package_items', 'status',
            'TINYINT NOT NULL DEFAULT 1 COMMENT \'状态：1=正常 2=删除\'');

        console.log('[Migration] 迁移成功完成');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] 迁移失败:', error.message);
        process.exit(1);
    }
}

up();
