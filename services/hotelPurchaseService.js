// services/hotelPurchaseService.js
const BasePurchaseService = require("./basePurchaseService");
const { RoomDatePrice, RoomInventory, RoomPackage, RoomType } = require("../models/Summary");
const redisService = require("./redisService");

class HotelPurchaseService extends BasePurchaseService {
  constructor() {
    super();
  }

  // 房型共享库存 key（按 roomTypeId，所有套餐共用）
  _getRoomTypeStockKey(roomTypeId, date) {
    return `hotel:roomtype:stock:${roomTypeId}:${date}`;
  }

  /**
   * 生成入住晚数区间 [checkIn, checkOut)
   * 酒店库存按"晚"扣减，离店当日不再占用库存，故不含 checkOut
   */
  _generateNights(checkIn, checkOut) {
    const dates = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    while (start < end) {
      dates.push(start.toISOString().split('T')[0]);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  }

  /**
   * 酒店套餐购买
   * @param {Object} params
   * @param {number} params.roomPackageId - 酒店套餐ID
   * @param {number} params.roomTypeId - 房型ID
   * @param {number} params.quantity - 购买数量
   * @param {number} params.userId - 用户ID
   * @param {string} params.orderNo - 订单号
   * @param {string} params.checkIn - 入住日期
   * @param {string} params.checkOut - 离店日期
   */
  async purchaseHotel({ roomPackageId, roomTypeId, quantity, userId, orderNo, checkIn, checkOut }) {
    // 1. 参数验证
    if (!roomPackageId || !roomTypeId || !userId) {
      throw new Error('缺少必要参数: roomPackageId, roomTypeId, userId 不能为空');
    }

    // 2. 获取日期范围
    const dateRange = this._generateNights(checkIn, checkOut);

    // 3. 检查并初始化库存
    await this._initializeHotelStock(roomPackageId, roomTypeId, dateRange);

    // 4. 构建库存key列表（只扣房型共享库存，按 roomTypeId）
    const stockKeys = [];
    for (const date of dateRange) {
      stockKeys.push(this._getRoomTypeStockKey(roomTypeId, date));
    }

    // 4. 扣减库存
    const result = await this.deductStock(stockKeys, quantity, userId, orderNo);

    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      success: true,
      dateRange: dateRange,
      stockKeys: stockKeys
    };
  }

  /**
   * 酒店退款恢复库存
   */
  async refundHotel({ roomPackageId, roomTypeId, quantity, checkIn, checkOut }) {
    const dateRange = this._generateNights(checkIn, checkOut);
    const stockKeys = [];

    for (const date of dateRange) {
      stockKeys.push(this._getRoomTypeStockKey(roomTypeId, date));
    }

    return await this.refundStock(stockKeys, quantity);
  }

  /**
   * 初始化酒店库存（房型共享库存，从 RoomInventory 读取）
   */
  async _initializeHotelStock(roomPackageId, roomTypeId, dateRange) {
    // 参数验证
    if (!roomPackageId || !roomTypeId) {
      throw new Error('缺少必要参数: roomPackageId, roomTypeId 不能为空');
    }

    // 获取房型信息（兜底默认值）
    const roomType = await RoomType.findOne({ where: { id: roomTypeId } });

    for (const date of dateRange) {
      // 房型共享库存（按 roomTypeId，所有套餐共用）
      const roomTypeStockKey = this._getRoomTypeStockKey(roomTypeId, date);
      let stock = await redisService.getFun(roomTypeStockKey, false);
      if (!stock) {
        // 从 RoomInventory 读取当日房型可用库存
        const roomInventory = await RoomInventory.findOne({
          where: { roomTypeId: roomTypeId, date: date }
        });
        const hotelStock = roomInventory ? (roomInventory.availableStock || roomType.stock) : roomType.stock;
        await this.initializeStock(roomTypeStockKey, hotelStock);
      }
    }
  }
}

module.exports = new HotelPurchaseService();