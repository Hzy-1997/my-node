/**
 * 数据迁移脚本：将 room_date_prices 的库存数据聚合迁移到 room_inventories
 *
 * 运行方式：node migrations/20260712000000-migrate-stock-to-room-inventory.js
 *
 * 逻辑：
 *   1. 确保 room_inventories 表存在（通过模型 sync）
 *   2. 从 room_date_prices 按 room_type_id + date 聚合：
 *        - stock         = MAX(stock)         （同一房型各套餐的 stock 应相同，取 max 防异常）
 *        - sold_stock    = SUM(sold_stock)    （合并各套餐已售）
 *        - available_stock = GREATEST(0, stock - sold_stock)  （已超卖则取 0）
 *   3. upsert 到 room_inventories（按 room_type_id + date 唯一）
 *
 * 注意：本脚本可重复执行（幂等），不会删除 room_date_prices 的库存列（双写过渡期保留）。
 */
const { sequelize } = require('../mysql/index');
const { RoomInventory } = require('../models/hotelModel/roomInventory');

async function migrate() {
    try {
        console.log('[迁移] 开始执行库存迁移...');

        // 1. 建表（如不存在）；不用 force 避免重复运行时删表丢数据
        await RoomInventory.sync();
        console.log('[迁移] room_inventories 表已就绪');

        // 2. 聚合迁移（MySQL 语法）
        const [results, meta] = await sequelize.query(`
            INSERT INTO room_inventories (room_type_id, date, stock, sold_stock, available_stock, created_at, updated_at)
            SELECT
                rp.room_type_id,
                rdp.date,
                MAX(rdp.stock) AS stock,
                SUM(COALESCE(rdp.sold_stock, 0)) AS sold_stock,
                GREATEST(0, MAX(rdp.stock) - SUM(COALESCE(rdp.sold_stock, 0))) AS available_stock,
                NOW(),
                NOW()
            FROM room_date_prices rdp
            JOIN room_packages rp ON rp.id = rdp.room_package_id
            GROUP BY rp.room_type_id, rdp.date
            ON DUPLICATE KEY UPDATE
                stock = VALUES(stock),
                sold_stock = VALUES(sold_stock),
                available_stock = VALUES(available_stock),
                updated_at = NOW()
        `);
        console.log('[迁移] 聚合迁移完成，影响行数:', meta);

        // 3. 校验结果
        const [rows] = await sequelize.query(`
            SELECT
                COUNT(*) AS total_records,
                SUM(CASE WHEN available_stock < 0 THEN 1 ELSE 0 END) AS negative_count,
                SUM(CASE WHEN available_stock = 0 THEN 1 ELSE 0 END) AS zero_count
            FROM room_inventories
        `);
        console.log('[迁移] 校验结果:', rows[0]);

        console.log('[迁移] 迁移成功完成');
        process.exit(0);
    } catch (error) {
        console.error('[迁移] 迁移失败:', error.message);
        process.exit(1);
    }
}

migrate();
