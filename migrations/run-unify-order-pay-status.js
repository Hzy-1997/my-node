/**
 * 独立运行脚本：订单状态统一改造（payStatus 五态）—— 表结构变更 + 存量数据迁移
 * 用法：node migrations/run-unify-order-pay-status.js
 *
 * 前置条件：无需重启服务、无需先跑 sync。只依赖数据库连接（config/config.json），
 *          幂等可重复执行，任意阶段失败后重跑均安全。
 *
 * 做的事：
 *   1. orders:                orderStatus → payStatus（建列 + 状态值重映射 + 删旧列）+ 新增 cancelReason
 *   2. package_order_details: order_status → pay_status（同上；该表为下划线列名风格）+ 新增 cancel_reason
 *   3. hotel_order:           status → payStatus（同上）+ 新增 cancelReason + 索引 idx_status → idx_payStatus
 *   4. scenicBusOrder:        orderStatus 值并入已有 payStatus 后删除旧列；payStatus 扩为五态
 *   5. campOrders:            删除 orderStatus（历史"已取消"并入 payStatus=5）；新增 alipayTradeNo/paymentTime/cancelReason
 *   6. parking_reservation:   删除 status；新增 cancelReason
 *
 * 状态值重映射（旧 → 新）：
 *   票务/套餐/酒店旧五态：1待支付 2已支付 3已取消 4已完成 5已退款
 *                      → 新：1待支付 2已支付 3已完成 4已退款 5已取消（即 1→1 2→2 3→5 4→3 5→4）
 *   公交旧 orderStatus： 1待支付 2待使用 3已完成 4已取消 5已退款
 *                      → 新：1待支付 2已支付 3已完成 4已退款 5已取消（即 1→1 2→2 3→3 4→5 5→4）
 *
 * 幂等性说明：
 *   - 列更名表：新列建出时允许 NULL 作为回填哨兵，重映射条件 `WHERE 新列 IS NULL`
 *     保证映射只发生一次，之后收紧为 NOT NULL 再删旧列
 *   - 公交并入表：映射结果由旧列值唯一决定，重复执行结果相同；旧列删除后整段跳过
 *   - 夏令"已取消"并入：条件带 payStatus=1，第二次执行时条件不再成立（0 行）
 *
 * 注：模型已改为 payStatus 语义，本脚本跑完后重启 node 服务即可正常读写。
 *     verifyStatus 值 3 的语义由旧"已取消核销"变为"已过期"（仅注释/展示层变化，数据不动）。
 */
const { sequelize } = require('../mysql/index');

// ---------- 通用工具（与 run-unify-payment-fields.js 风格一致） ----------

async function columnExists(tableName, columnName) {
    const [rows] = await sequelize.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        { replacements: [tableName, columnName] }
    );
    return rows[0].cnt > 0;
}

// 探测真实列名（项目里 camelCase / snake_case 混用：package_order_details 为下划线风格）
async function getRealColumnName(tableName, possibleNames) {
    const [rows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN (?)`,
        { replacements: [tableName, possibleNames] }
    );
    if (rows.length === 0) return null;
    return rows[0].column_name || rows[0].COLUMN_NAME;
}

async function indexExists(tableName, indexName) {
    const [rows] = await sequelize.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
        { replacements: [tableName, indexName] }
    );
    return rows[0].cnt > 0;
}

async function addColumnIfNotExists(tableName, columnName, definition) {
    if (await columnExists(tableName, columnName)) {
        console.log(`[Migration] ${tableName}.${columnName} 已存在，跳过`);
        return;
    }
    await sequelize.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    console.log(`[Migration] ${tableName}.${columnName} 已添加`);
}

async function dropColumnIfExists(tableName, columnName) {
    if (!columnName || !(await columnExists(tableName, columnName))) {
        console.log(`[Migration] ${tableName}.${columnName || '(空)'} 不存在，跳过删除`);
        return;
    }
    try {
        await sequelize.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
        console.log(`[Migration] ${tableName}.${columnName} 旧列已删除`);
    } catch (e) {
        console.log(`[Migration] ${tableName}.${columnName} 删除失败（可能被外键/索引依赖）:`, e.message);
    }
}

// 仅更新列注释/约束（列不存在则跳过，失败不中断）
async function modifyColumn(tableName, columnName, definition) {
    if (!columnName || !(await columnExists(tableName, columnName))) {
        console.log(`[Migration] ${tableName}.${columnName || '(空)'} 不存在，跳过 MODIFY`);
        return;
    }
    try {
        await sequelize.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${definition}`);
        console.log(`[Migration] ${tableName}.${columnName} 定义已更新`);
    } catch (e) {
        console.log(`[Migration] ${tableName}.${columnName} 定义更新失败:`, e.message);
    }
}

/**
 * 旧状态列 → 新 payStatus 列：建列 → 状态值重映射 → 收紧约束 → 删旧列
 *
 * 幂等核心：新列建出时允许 NULL 作为回填哨兵，
 *   重映射的 WHERE 条件为 `新列 IS NULL`，无论重跑多少遍映射只发生一次；
 *   中途失败后重跑也会收敛到同一结果。
 */
async function migrateStatusColumn(tableName, oldCol, newCol, newType, newComment, caseExpr) {
    const oldExists = oldCol ? await columnExists(tableName, oldCol) : false;
    const newExists = await columnExists(tableName, newCol);

    if (!oldExists && !newExists) {
        console.log(`[Migration] ${tableName}: 既无旧状态列也无 ${newCol}，跳过（表可能尚未创建）`);
        return;
    }

    // 1. 建新列（允许 NULL 作为回填哨兵）
    if (!newExists) {
        await sequelize.query(
            `ALTER TABLE \`${tableName}\` ADD COLUMN \`${newCol}\` ${newType} NULL COMMENT '${newComment}'`
        );
        console.log(`[Migration] ${tableName}.${newCol} 已创建（待回填）`);
    } else {
        console.log(`[Migration] ${tableName}.${newCol} 已存在`);
    }

    // 2. 状态值重映射（仅旧列还在时执行；WHERE 新列 IS NULL 保证幂等）
    if (oldExists && caseExpr) {
        const [, meta] = await sequelize.query(
            `UPDATE \`${tableName}\` SET \`${newCol}\` = ${caseExpr} WHERE \`${newCol}\` IS NULL`
        );
        console.log(`[Migration] ${tableName}: ${oldCol} → ${newCol} 状态值已重映射（影响 ${meta.affectedRows} 行）`);
    }

    // 3. 收紧为 NOT NULL DEFAULT 1（同步更新注释）
    await modifyColumn(tableName, newCol, `${newType} NOT NULL DEFAULT 1 COMMENT '${newComment}'`);

    // 4. 删除旧列
    if (oldExists) {
        await dropColumnIfExists(tableName, oldCol);
    }
}

// 旧五态 → 新五态：1待支付→1 2已支付→2 3已取消→5 4已完成→3 5已退款→4
function unifyCase(oldCol) {
    return `CASE \`${oldCol}\` WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 4 ELSE 1 END`;
}

// 公交旧 orderStatus（1待支付 2待使用 3已完成 4已取消 5已退款）→ 新五态
function busCase(oldCol, newCol) {
    return `CASE \`${oldCol}\` WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 5 WHEN 5 THEN 4 ELSE \`${newCol}\` END`;
}

async function up() {
    try {
        console.log('[Migration] 开始执行订单状态统一（payStatus 五态）迁移...');

        // ========== 1. orders（票务订单）==========
        console.log('\n--- 1. orders ---');
        const ordersOld = await getRealColumnName('orders', ['orderStatus', 'order_status']);
        const ordersNew = await getRealColumnName('orders', ['payStatus', 'pay_status']) || 'payStatus';
        await migrateStatusColumn(
            'orders', ordersOld, ordersNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            ordersOld ? unifyCase(ordersOld) : null
        );
        await addColumnIfNotExists('orders', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        // verifyStatus 注释更新：值 3 语义由"已取消核销"改为"已过期"（数据不动）
        await modifyColumn('orders', 'verifyStatus',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);

        // ========== 2. package_order_details（套餐订单，下划线列名风格）==========
        console.log('\n--- 2. package_order_details ---');
        const pkgOld = await getRealColumnName('package_order_details', ['orderStatus', 'order_status']);
        const pkgNew = await getRealColumnName('package_order_details', ['payStatus', 'pay_status']) || 'pay_status';
        await migrateStatusColumn(
            'package_order_details', pkgOld, pkgNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            pkgOld ? unifyCase(pkgOld) : null
        );
        await addColumnIfNotExists('package_order_details', 'cancel_reason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        await modifyColumn('package_order_details', 'verify_status',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);

        // ========== 3. hotel_order（酒店订单）==========
        console.log('\n--- 3. hotel_order ---');
        const hotelOld = await getRealColumnName('hotel_order', ['status']);
        const hotelNew = await getRealColumnName('hotel_order', ['payStatus', 'pay_status']) || 'payStatus';
        await migrateStatusColumn(
            'hotel_order', hotelOld, hotelNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            hotelOld ? unifyCase(hotelOld) : null
        );
        await addColumnIfNotExists('hotel_order', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        await modifyColumn('hotel_order', 'verifyStatus',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);
        // 索引：删 status 列时 idx_status 会被自动移除，兜底清理 + 补建 idx_payStatus
        if (await indexExists('hotel_order', 'idx_status')) {
            try {
                await sequelize.query('ALTER TABLE `hotel_order` DROP INDEX `idx_status`');
                console.log('[Migration] hotel_order 旧索引 idx_status 已删除');
            } catch (e) {
                console.log('[Migration] hotel_order 删除旧索引 idx_status 失败:', e.message);
            }
        }
        if (!(await indexExists('hotel_order', 'idx_payStatus'))) {
            try {
                await sequelize.query(`ALTER TABLE \`hotel_order\` ADD INDEX \`idx_payStatus\` (\`${hotelNew}\`)`);
                console.log('[Migration] hotel_order 索引 idx_payStatus 已创建');
            } catch (e) {
                console.log('[Migration] hotel_order 创建索引 idx_payStatus 失败:', e.message);
            }
        }

        // ========== 4. scenicBusOrder（公交订单：orderStatus 并入已有 payStatus）==========
        console.log('\n--- 4. scenicBusOrder ---');
        const busOld = await getRealColumnName('scenicBusOrder', ['orderStatus', 'order_status']);
        const busNew = await getRealColumnName('scenicBusOrder', ['payStatus', 'pay_status']) || 'payStatus';
        // 保证 payStatus 列存在（正常情况旧表已带该列，此步为兜底）
        await addColumnIfNotExists('scenicBusOrder', busNew,
            `TINYINT NULL DEFAULT 1 COMMENT '订单状态（统一五态）1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);
        if (busOld) {
            // 旧 orderStatus 语义更完整，以其为准并入 payStatus；
            // 重复执行结果一致（映射由旧列值唯一决定），旧列删除后本段整体跳过
            const [, meta] = await sequelize.query(
                `UPDATE \`scenicBusOrder\` SET \`${busNew}\` = ${busCase(busOld, busNew)} WHERE \`${busOld}\` IS NOT NULL`
            );
            console.log(`[Migration] scenicBusOrder: ${busOld} 已并入 ${busNew}（影响 ${meta.affectedRows} 行）`);
            await dropColumnIfExists('scenicBusOrder', busOld);
        } else {
            console.log('[Migration] scenicBusOrder.orderStatus 不存在，跳过并入');
        }
        // 收紧约束 + 注释扩为五态
        await modifyColumn('scenicBusOrder', busNew,
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态（统一五态）1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);
        await addColumnIfNotExists('scenicBusOrder', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);

        // ========== 5. campOrders（夏令营订单）==========
        console.log('\n--- 5. campOrders ---');
        await addColumnIfNotExists('campOrders', 'alipayTradeNo', `VARCHAR(64) NULL COMMENT '支付宝交易号'`);
        await addColumnIfNotExists('campOrders', 'paymentTime', `DATETIME NULL COMMENT '支付时间'`);
        await addColumnIfNotExists('campOrders', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        const campOld = await getRealColumnName('campOrders', ['orderStatus', 'order_status']);
        if (campOld) {
            // 旧 orderStatus 语义混乱（1待确认 2已确认 4已取消），仅把明确的"已取消"并入 payStatus=5；
            // 条件带 payStatus=1：第二次执行时条件不再成立（0 行），幂等
            const [, meta] = await sequelize.query(
                `UPDATE \`campOrders\` SET \`payStatus\` = 5, \`cancelReason\` = COALESCE(\`cancelReason\`, '历史取消（原${campOld}=4）')
                 WHERE \`${campOld}\` = 4 AND \`payStatus\` = 1`
            );
            console.log(`[Migration] campOrders: 历史"已取消"已并入 payStatus=5（影响 ${meta.affectedRows} 行）`);
            await dropColumnIfExists('campOrders', campOld);
        } else {
            console.log('[Migration] campOrders.orderStatus 不存在，跳过删除');
        }
        await modifyColumn('campOrders', 'payStatus',
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态 1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);

        // ========== 6. parking_reservation（停车预约）==========
        console.log('\n--- 6. parking_reservation ---');
        await addColumnIfNotExists('parking_reservation', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        // 旧 status 为预约状态（0/1/2），语义已废；payStatus 保留原值承载五态
        const parkOld = await getRealColumnName('parking_reservation', ['status']);
        await dropColumnIfExists('parking_reservation', parkOld);
        await modifyColumn('parking_reservation', 'payStatus',
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态：1-待支付 2-已支付(停车业务不使用) 3-已完成 4-已退款 5-已取消'`);

        console.log('\n[Migration] 迁移成功完成。请重启 node 服务使新模型生效。');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] 迁移失败:', error.message);
        process.exit(1);
    }
}

up();
