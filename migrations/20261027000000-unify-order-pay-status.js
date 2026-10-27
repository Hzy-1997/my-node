/*
 * @描述: 订单状态统一改造（payStatus 五态）—— 结构变更 + 存量状态值迁移
 *        与 run-unify-order-pay-status.js 逻辑一致（独立运行请用后者：
 *        node migrations/run-unify-order-pay-status.js）
 *
 *        1. orders:                orderStatus → payStatus（状态值重映射）+ cancelReason
 *        2. package_order_details: order_status → pay_status（同上，下划线列名风格）+ cancel_reason
 *        3. hotel_order:           status → payStatus（同上）+ cancelReason + 索引 idx_status → idx_payStatus
 *        4. scenicBusOrder:        orderStatus 并入已有 payStatus 后删除
 *        5. campOrders:            删除 orderStatus + 新增 alipayTradeNo/paymentTime/cancelReason
 *        6. parking_reservation:   删除 status + 新增 cancelReason
 *
 *        状态值重映射：旧 1待支付 2已支付 3已取消 4已完成 5已退款
 *                    → 新 1待支付 2已支付 3已完成 4已退款 5已取消（1→1 2→2 3→5 4→3 5→4）
 *
 *        幂等核心：新列建出时允许 NULL 作为回填哨兵，
 *        重映射条件 `WHERE 新列 IS NULL` 保证映射只发生一次。
 * @日期: 2026-10-27
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const q = (sql, replacements) => queryInterface.sequelize.query(sql, replacements ? { replacements } : undefined);

        // ---------- 通用工具 ----------
        async function columnExists(tableName, columnName) {
            const [rows] = await q(
                `SELECT COUNT(*) AS cnt FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
                [tableName, columnName]
            );
            return rows[0].cnt > 0;
        }

        // 探测真实列名（camelCase / snake_case 混用兜底）
        async function getRealColumnName(tableName, possibleNames) {
            const [rows] = await q(
                `SELECT column_name FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN (?)`,
                [tableName, possibleNames]
            );
            if (rows.length === 0) return null;
            return rows[0].column_name || rows[0].COLUMN_NAME;
        }

        async function indexExists(tableName, indexName) {
            const [rows] = await q(
                `SELECT COUNT(*) AS cnt FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
                [tableName, indexName]
            );
            return rows[0].cnt > 0;
        }

        async function addColumnIfNotExists(tableName, columnName, definition) {
            if (await columnExists(tableName, columnName)) {
                console.log(`[Migration] ${tableName}.${columnName} 已存在，跳过`);
                return;
            }
            await q(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
            console.log(`[Migration] ${tableName}.${columnName} 已添加`);
        }

        async function dropColumnIfExists(tableName, columnName) {
            if (!columnName || !(await columnExists(tableName, columnName))) {
                console.log(`[Migration] ${tableName}.${columnName || '(空)'} 不存在，跳过删除`);
                return;
            }
            try {
                await q(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
                console.log(`[Migration] ${tableName}.${columnName} 旧列已删除`);
            } catch (e) {
                console.log(`[Migration] ${tableName}.${columnName} 删除失败:`, e.message);
            }
        }

        async function modifyColumn(tableName, columnName, definition) {
            if (!columnName || !(await columnExists(tableName, columnName))) {
                console.log(`[Migration] ${tableName}.${columnName || '(空)'} 不存在，跳过 MODIFY`);
                return;
            }
            try {
                await q(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${definition}`);
                console.log(`[Migration] ${tableName}.${columnName} 定义已更新`);
            } catch (e) {
                console.log(`[Migration] ${tableName}.${columnName} 定义更新失败:`, e.message);
            }
        }

        // 旧状态列 → 新 payStatus 列（幂等：NULL 哨兵回填只发生一次）
        async function migrateStatusColumn(tableName, oldCol, newCol, newType, newComment, caseExpr) {
            const oldExists = oldCol ? await columnExists(tableName, oldCol) : false;
            const newExists = await columnExists(tableName, newCol);

            if (!oldExists && !newExists) {
                console.log(`[Migration] ${tableName}: 既无旧状态列也无 ${newCol}，跳过`);
                return;
            }
            if (!newExists) {
                await q(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${newCol}\` ${newType} NULL COMMENT '${newComment}'`);
                console.log(`[Migration] ${tableName}.${newCol} 已创建（待回填）`);
            }
            if (oldExists && caseExpr) {
                const [, meta] = await q(
                    `UPDATE \`${tableName}\` SET \`${newCol}\` = ${caseExpr} WHERE \`${newCol}\` IS NULL`
                );
                console.log(`[Migration] ${tableName}: ${oldCol} → ${newCol} 状态值已重映射（影响 ${meta.affectedRows} 行）`);
            }
            await modifyColumn(tableName, newCol, `${newType} NOT NULL DEFAULT 1 COMMENT '${newComment}'`);
            if (oldExists) {
                await dropColumnIfExists(tableName, oldCol);
            }
        }

        // 旧五态 → 新五态：1→1 2→2 3→5 4→3 5→4
        const unifyCase = (oldCol) =>
            `CASE \`${oldCol}\` WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 4 ELSE 1 END`;
        // 公交旧 orderStatus（1待支付 2待使用 3已完成 4已取消 5已退款）→ 新五态
        const busCase = (oldCol, newCol) =>
            `CASE \`${oldCol}\` WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 5 WHEN 5 THEN 4 ELSE \`${newCol}\` END`;

        // ========== 1. orders ==========
        const ordersOld = await getRealColumnName('orders', ['orderStatus', 'order_status']);
        const ordersNew = await getRealColumnName('orders', ['payStatus', 'pay_status']) || 'payStatus';
        await migrateStatusColumn('orders', ordersOld, ordersNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            ordersOld ? unifyCase(ordersOld) : null);
        await addColumnIfNotExists('orders', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        await modifyColumn('orders', 'verifyStatus',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);

        // ========== 2. package_order_details（下划线列名风格）==========
        const pkgOld = await getRealColumnName('package_order_details', ['orderStatus', 'order_status']);
        const pkgNew = await getRealColumnName('package_order_details', ['payStatus', 'pay_status']) || 'pay_status';
        await migrateStatusColumn('package_order_details', pkgOld, pkgNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            pkgOld ? unifyCase(pkgOld) : null);
        await addColumnIfNotExists('package_order_details', 'cancel_reason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        await modifyColumn('package_order_details', 'verify_status',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);

        // ========== 3. hotel_order ==========
        const hotelOld = await getRealColumnName('hotel_order', ['status']);
        const hotelNew = await getRealColumnName('hotel_order', ['payStatus', 'pay_status']) || 'payStatus';
        await migrateStatusColumn('hotel_order', hotelOld, hotelNew, 'INT',
            '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消（统一五态）',
            hotelOld ? unifyCase(hotelOld) : null);
        await addColumnIfNotExists('hotel_order', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        await modifyColumn('hotel_order', 'verifyStatus',
            `INT NULL DEFAULT 1 COMMENT '核销状态：1-待核销 2-已完成(已核销) 3-已过期(超使用期未核销)'`);
        if (await indexExists('hotel_order', 'idx_status')) {
            try { await q('ALTER TABLE `hotel_order` DROP INDEX `idx_status`'); } catch (e) { /* 兜底清理 */ }
        }
        if (!(await indexExists('hotel_order', 'idx_payStatus'))) {
            try { await q(`ALTER TABLE \`hotel_order\` ADD INDEX \`idx_payStatus\` (\`${hotelNew}\`)`); } catch (e) {
                console.log('[Migration] hotel_order 创建索引 idx_payStatus 失败:', e.message);
            }
        }

        // ========== 4. scenicBusOrder（orderStatus 并入已有 payStatus）==========
        const busOld = await getRealColumnName('scenicBusOrder', ['orderStatus', 'order_status']);
        const busNew = await getRealColumnName('scenicBusOrder', ['payStatus', 'pay_status']) || 'payStatus';
        await addColumnIfNotExists('scenicBusOrder', busNew,
            `TINYINT NULL DEFAULT 1 COMMENT '订单状态（统一五态）1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);
        if (busOld) {
            const [, meta] = await q(
                `UPDATE \`scenicBusOrder\` SET \`${busNew}\` = ${busCase(busOld, busNew)} WHERE \`${busOld}\` IS NOT NULL`
            );
            console.log(`[Migration] scenicBusOrder: ${busOld} 已并入 ${busNew}（影响 ${meta.affectedRows} 行）`);
            await dropColumnIfExists('scenicBusOrder', busOld);
        }
        await modifyColumn('scenicBusOrder', busNew,
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态（统一五态）1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);
        await addColumnIfNotExists('scenicBusOrder', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);

        // ========== 5. campOrders ==========
        await addColumnIfNotExists('campOrders', 'alipayTradeNo', `VARCHAR(64) NULL COMMENT '支付宝交易号'`);
        await addColumnIfNotExists('campOrders', 'paymentTime', `DATETIME NULL COMMENT '支付时间'`);
        await addColumnIfNotExists('campOrders', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        const campOld = await getRealColumnName('campOrders', ['orderStatus', 'order_status']);
        if (campOld) {
            const [, meta] = await q(
                `UPDATE \`campOrders\` SET \`payStatus\` = 5, \`cancelReason\` = COALESCE(\`cancelReason\`, '历史取消（原${campOld}=4）')
                 WHERE \`${campOld}\` = 4 AND \`payStatus\` = 1`
            );
            console.log(`[Migration] campOrders: 历史"已取消"已并入 payStatus=5（影响 ${meta.affectedRows} 行）`);
            await dropColumnIfExists('campOrders', campOld);
        }
        await modifyColumn('campOrders', 'payStatus',
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态 1:待支付 2:已支付 3:已完成 4:已退款 5:已取消'`);

        // ========== 6. parking_reservation ==========
        await addColumnIfNotExists('parking_reservation', 'cancelReason', `VARCHAR(255) NULL COMMENT '取消原因'`);
        const parkOld = await getRealColumnName('parking_reservation', ['status']);
        await dropColumnIfExists('parking_reservation', parkOld);
        await modifyColumn('parking_reservation', 'payStatus',
            `TINYINT NOT NULL DEFAULT 1 COMMENT '订单状态：1-待支付 2-已支付(停车业务不使用) 3-已完成 4-已退款 5-已取消'`);
    },

    async down(queryInterface, Sequelize) {
        // 回滚：恢复旧结构（状态值语义不可逆，仅恢复列结构）
        const tryAdd = async (t, c, d) => { try { await queryInterface.addColumn(t, c, d); } catch (e) { /* 已存在 */ } };
        const tryDrop = async (t, c) => { try { await queryInterface.removeColumn(t, c); } catch (e) { /* 不存在 */ } };

        await tryAdd('orders', 'orderStatus', { type: Sequelize.INTEGER, defaultValue: 1 });
        await tryAdd('package_order_details', 'order_status', { type: Sequelize.INTEGER, defaultValue: 1 });
        await tryAdd('hotel_order', 'status', { type: Sequelize.INTEGER, defaultValue: 1 });
        await tryAdd('scenicBusOrder', 'orderStatus', { type: Sequelize.TINYINT, defaultValue: 1 });
        await tryAdd('campOrders', 'orderStatus', { type: Sequelize.TINYINT, defaultValue: 1 });
        await tryAdd('parking_reservation', 'status', { type: Sequelize.TINYINT, defaultValue: 0 });

        await tryDrop('orders', 'payStatus');
        await tryDrop('orders', 'cancelReason');
        await tryDrop('package_order_details', 'pay_status');
        await tryDrop('package_order_details', 'cancel_reason');
        await tryDrop('hotel_order', 'payStatus');
        await tryDrop('hotel_order', 'cancelReason');
        await tryDrop('scenicBusOrder', 'cancelReason');
        await tryDrop('campOrders', 'alipayTradeNo');
        await tryDrop('campOrders', 'paymentTime');
        await tryDrop('campOrders', 'cancelReason');
        await tryDrop('parking_reservation', 'cancelReason');
    }
};
