/**
 * 独立运行脚本：为 touristServices 表新增三个详情字段
 *   chargeStandard       收费标准
 *   notice               注意事项
 *   facilityIntroduction 设施介绍
 * 用法：node migrations/run-add-service-detail-fields-to-touristServices.js
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
        console.log('[Migration] 开始执行 touristServices 详情字段迁移...');

        // 收费标准（与模型 DataTypes.STRING 对应，VARCHAR(255)）
        await addColumnIfNotExists('touristServices', 'chargeStandard',
            'VARCHAR(255) NULL COMMENT \'收费标准\'');

        // 注意事项（内容较长，用 TEXT，模型 DataTypes.STRING 可正常读写）
        await addColumnIfNotExists('touristServices', 'notice',
            'TEXT NULL COMMENT \'注意事项\'');

        // 设施介绍（内容较长，用 TEXT，模型 DataTypes.STRING 可正常读写）
        await addColumnIfNotExists('touristServices', 'facilityIntroduction',
            'TEXT NULL COMMENT \'设施介绍\'');

        console.log('[Migration] 迁移成功完成');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] 迁移失败:', error.message);
        process.exit(1);
    }
}

up();
