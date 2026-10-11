/**
 * 独立运行脚本：统一各业务订单表的支付字段
 * 用法：node migrations/run-unify-payment-fields.js
 *
 * 做的事：
 *   1. hotel_order:        旧 roomName → title、旧 amount → orderAmount（搬数据 + 删旧列）
 *   2. parking_reservation:旧 price → orderAmount、旧 orderNo → orderNumber
 *   3. package_order_details: itemName → title（仅回填，保留 itemName）
 *
 * 幂等：重复执行不会报错（旧列不存在则跳过）
 *
 * 执行前请先确保已运行过 sequelize.sync({alter:true})，新列 title/orderAmount 已存在
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

async function getRealColumnName(tableName, possibleNames) {
    const [rows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?
         AND column_name IN (?)`,
        { replacements: [tableName, possibleNames] }
    );
    if (rows.length === 0) return null;
    return rows[0].column_name || rows[0].COLUMN_NAME || rows[0].COLUMN_NAME;
}

async function migrateColumn(tableName, oldCol, newCol) {
    const oldExists = await columnExists(tableName, oldCol);
    const newExists = await columnExists(tableName, newCol);
    if (!oldExists) {
        console.log(`[Migration] ${tableName}.${oldCol} 不存在，跳过`);
        return;
    }
    if (!newExists) {
        console.log(`[Migration] ${tableName}.${newCol} 不存在，请先 sync 模型！跳过`);
        return;
    }
    // 数据回填：仅当新列 IS NULL 时拷贝旧列值
    await sequelize.query(
        `UPDATE \`${tableName}\` SET \`${newCol}\` = \`${oldCol}\` WHERE \`${newCol}\` IS NULL AND \`${oldCol}\` IS NOT NULL`
    );
    console.log(`[Migration] ${tableName}: ${oldCol} → ${newCol} 数据已回填`);
    // 删除旧列
    try {
        await sequelize.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${oldCol}\``);
        console.log(`[Migration] ${tableName}.${oldCol} 旧列已删除`);
    } catch (e) {
        console.log(`[Migration] ${tableName}.${oldCol} 删除失败（可能被索引/外键依赖）:`, e.message);
    }
}

async function up() {
    try {
        console.log('[Migration] 开始执行统一支付字段迁移...');

        // === 1. hotel_order ===
        console.log('\n--- 1. hotel_order ---');
        await migrateColumn('hotel_order', 'roomName', 'title');
        await migrateColumn('hotel_order', 'amount', 'orderAmount');

        // === 2. parking_reservation ===
        console.log('\n--- 2. parking_reservation ---');
        await migrateColumn('parking_reservation', 'price', 'orderAmount');

        const parkingHasOrderNo = await columnExists('parking_reservation', 'orderNo');
        const parkingHasOrderNumber = await columnExists('parking_reservation', 'orderNumber');
        if (parkingHasOrderNo && !parkingHasOrderNumber) {
            await sequelize.query(
                `ALTER TABLE \`parking_reservation\` CHANGE COLUMN \`orderNo\` \`orderNumber\` VARCHAR(50) NULL UNIQUE COMMENT '订单编号'`
            );
            console.log('[Migration] parking_reservation.orderNo → orderNumber 重命名完成');
        } else if (parkingHasOrderNo && parkingHasOrderNumber) {
            await migrateColumn('parking_reservation', 'orderNo', 'orderNumber');
        } else {
            console.log('[Migration] parking_reservation.orderNo 不存在，跳过');
        }

        // === 3. package_order_details ===
        console.log('\n--- 3. package_order_details ---');
        const realItemName = await getRealColumnName('package_order_details', ['itemName', 'item_name']);
        const pkgHasTitle = await columnExists('package_order_details', 'title');
        if (realItemName && pkgHasTitle) {
            await sequelize.query(
                `UPDATE \`package_order_details\` SET \`title\` = \`${realItemName}\` WHERE \`title\` IS NULL AND \`${realItemName}\` IS NOT NULL`
            );
            console.log(`[Migration] package_order_details: ${realItemName} → title 数据已回填（保留 ${realItemName} 列）`);
        } else {
            console.log('[Migration] package_order_details 无需回填 title');
        }

        console.log('\n[Migration] 迁移成功完成');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] 迁移失败:', error.message);
        process.exit(1);
    }
}

up();
