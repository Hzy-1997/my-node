// services/comboPurchaseService.js
const BasePurchaseService = require("./basePurchaseService");
const { PackageDatePrice, RoomDatePrice, RoomInventory, PackageItem, RoomType } = require("../models/Summary");
const redisService = require("./redisService");

class ComboPurchaseService extends BasePurchaseService {
    constructor() {
        super();
    }

    _getComboStockKey(packageItemId, date) {
        return `combo:stock:${packageItemId}:${date}`;
    }

    _getHotelStockKey(roomTypeId, date) {
        return `hotel:roomtype:stock:${roomTypeId}:${date}`;
    }

    /**
     * 套餐购买
     * packageItemId: 套餐id,
     * quantity: 购买数量,
     * userId: 用户ID,
     * orderNo: 订单号,
     * date: 日期,
     * roomTypeId: 房型id（可选）
     */
    async purchaseCombo({ packageItemId, quantity, userId, orderNo, date, roomTypeId = null }) {
        // 参数验证
        if (!packageItemId || !userId || !date) {
            throw new Error('缺少必要参数: packageItemId, userId, date 不能为空');
        }

        const stockKeys = [];

        // 套餐库存key
        stockKeys.push(this._getComboStockKey(packageItemId, date));
        console.log("套餐库存key", stockKeys)
        // 如果包含酒店房型，需要同时检查房型库存
        if (roomTypeId) {
            stockKeys.push(this._getHotelStockKey(roomTypeId, date));
        }

        console.log("stockKeys", roomTypeId, stockKeys)

        // 扣减库存
        const result = await this.deductStock(stockKeys, quantity, userId, orderNo);

        console.log("扣减库存结果", result)


        if (!result.success) {
            return {
                success: false,
                code: result.code,
                message: result.message
            };
        }

        return {
            success: true,
            stockKeys: stockKeys
        };
    }

    /**
     * 多日期套餐购买（酒店套餐场景）
     * packageItemId: 套餐id,
     * roomTypeId: 房型id,
     * quantity: 购买数量,
     * userId: 用户ID,
     * orderNo: 订单号,
     * startDate: 开始日期,
     * endDate: 结束日期,
     */
    async purchaseComboMultiDate({ packageItemId, roomTypeId, quantity, userId, orderNo, startDate, endDate }) {
        const dateRange = this.generateDateRange(startDate, endDate);

        // 初始化库存
        await this.initializeComboStock(packageItemId, roomTypeId, dateRange);

        // 依次扣减每天的库存
        const allStockKeys = [];
        for (const date of dateRange) {
            const stockKeys = [
                this._getComboStockKey(packageItemId, date),
                this._getHotelStockKey(roomTypeId, date)
            ];

            const result = await this.deductStock(stockKeys, quantity, userId, orderNo);
            if (!result.success) {
                // 回滚已扣减的库存
                if (allStockKeys.length > 0) {
                    await this.refundStock(allStockKeys.flat(), quantity);
                }
                throw new Error(result.message);
            }
            allStockKeys.push(stockKeys);
        }

        return {
            success: true,
            dateRange: dateRange,
            stockKeys: allStockKeys.flat()
        };
    }

    /**
     * 初始化单个日期的套餐库存（被combo.js调用）
     * packageItemId: 套餐id,
     * date: 日期, YYYY-MM-DD
     * stock: 库存数量
     */
    async initializeComboStock(packageItemId, date, stock) {
        const comboStockKey = this._getComboStockKey(packageItemId, date);
        await this.initializeStock(comboStockKey, stock);
    }

    /**
     * 批量初始化套餐库存
     * packageItemId: 套餐id,
     * roomTypeId: 房型id,
     * dateRange: 日期范围, [YYYY-MM-DD, YYYY-MM-DD]
     */
    async initializeComboStockMultiDate(packageItemId, roomTypeId, dateRange) {
        const combo = await PackageItem.findOne({
            where: { id: packageItemId }
        });

        for (const date of dateRange) {
            // 套餐库存
            const comboStockKey = this._getComboStockKey(packageItemId, date);
            let stock = await redisService.getFun(comboStockKey, false);
            if (!stock) {
                const datePrice = await PackageDatePrice.findOne({
                    where: { packageItemId: packageItemId, date: date }
                });
                const comboStock = datePrice ? (datePrice.availableStock || combo.maxSaleNum) : combo.maxSaleNum;
                await this.initializeStock(comboStockKey, comboStock);
            }

            // 房型库存（房型共享库存，从 RoomInventory 读取）
            if (roomTypeId) {
                const hotelStockKey = this._getHotelStockKey(roomTypeId, date);
                stock = await redisService.getFun(hotelStockKey, false);
                if (!stock) {
                    const roomType = await RoomType.findOne({ where: { id: roomTypeId } });
                    const roomInventory = await RoomInventory.findOne({
                        where: { roomTypeId: roomTypeId, date: date }
                    });
                    const hotelStock = roomInventory ? (roomInventory.availableStock || roomType.stock) : roomType.stock;
                    await this.initializeStock(hotelStockKey, hotelStock);
                }
            }
        }
    }
}

module.exports = new ComboPurchaseService();