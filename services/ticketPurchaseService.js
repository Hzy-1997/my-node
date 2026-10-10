/**
 * 票务购买服务（统一使用 Lua 脚本）
 * 支持普通抢票和选座抢票
 */
const fs = require("fs"); // 引入文件系统模块
const path = require("path");  // 引入路径模块
const { RedisService } = require("./redisService");

class TicketPurchaseService extends RedisService {
  constructor() {
    super();
    // 加载 Lua 脚本
    this.luaDir = path.join(__dirname, "../lua/ticket");
    this.scripts = {
      // 抢票脚本
      ticketPurchase: fs.readFileSync(
        path.join(this.luaDir, "ticket_purchase.lua"),
        "utf8",
      ),
      ticketPurchaseSeat: fs.readFileSync(
        path.join(this.luaDir, "ticket_purchase_seat.lua"),
        "utf8",
      ),
      // 选座脚本
      realtimeLock: fs.readFileSync(
        path.join(this.luaDir, "seat_realtime_lock.lua"),
        "utf8",
      ),
      unlockSingle: fs.readFileSync(
        path.join(this.luaDir, "seat_unlock_single.lua"),
        "utf8",
      ),
      validateAndExtend: fs.readFileSync(
        path.join(this.luaDir, "seat_validate_and_extend.lua"),
        "utf8",
      ),
      releaseAll: fs.readFileSync(
        path.join(this.luaDir, "seat_release_all.lua"),
        "utf8",
      ),
      confirm: fs.readFileSync(
        path.join(this.luaDir, "seat_confirm.lua"),
        "utf8",
      ),
    };

    // 脚本 SHA 缓存
    this.scriptSha = {};

    // 初始化脚本
    this._initScripts();
  }

  async _initScripts() {
    try {
      for (const [name, script] of Object.entries(this.scripts)) {

        this.scriptSha[name] = await this.scriptLoad(script);
        console.log(`[TicketPurchase] 脚本加载成功: ${name}`);
      }
    } catch (error) {
      console.error("[TicketPurchase] 脚本加载失败:", error);
    }
  }

  async scriptLoad(script) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.scriptLoad(script);
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  _getStockKey(ticketId) {
    return `ticket:stock:${ticketId}`;
  }

  _getPurchaseKey(userId, ticketId) {
    return `purchase:${userId}:${ticketId}`;
  }

  _getSeatStatusKey(ticketId) {
    return `seat:status:${ticketId}`;
  }

  // ==================== 普通抢票（无需选座）====================

  /**
   * 普通抢票（无需选座）
   * @param {Object} params
   * @param {number} params.ticketId - 票务ID
   * @param {number} params.userId - 用户ID
   * @param {number} params.quantity - 购买数量
   * @param {string} params.orderNo - 订单号
   */
  async purchaseTicket({ ticketId, userId, quantity, orderNo }) {
    const stockKey = this._getStockKey(ticketId);
    const purchaseKey = this._getPurchaseKey(userId, ticketId);
    const expireTime = Date.now() + 86400 * 1000; // 24小时

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.ticketPurchase, {
        keys: [stockKey, purchaseKey],
        arguments: [String(userId), String(quantity), orderNo, String(expireTime)],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 抢票失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  // ==================== 选座抢票（需要选座）====================

  /**
   * 选座抢票（创建订单时调用）
   * @param {Object} params
   * @param {number} params.ticketId - 票务ID
   * @param {number} params.userId - 用户ID
   * @param {Array} params.seats - 座位列表 [{row, col}]
   * @param {string} params.orderNo - 订单号
   */
  async purchaseTicketWithSeat({ ticketId, userId, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const purchaseKey = this._getPurchaseKey(userId, ticketId);
    const expireTime = Date.now() + 600 * 1000; // 10分钟

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.ticketPurchaseSeat, {
        keys: [statusKey, purchaseKey],
        arguments: [String(userId), orderNo, String(expireTime), String(seats.length), ...seatKeys],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 选座抢票失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 实时锁定单个座位
   * @param {Object} params
   * @param {number} params.ticketId - 票务ID
   * @param {number} params.row - 行号
   * @param {number} params.col - 列号
   * @param {string} params.seatNo - 座位名称
   * @param {number} params.userId - 用户ID
   * @param {number} params.expireSeconds - 过期秒数（默认180秒=3分钟）
   */
  async lockSeat({ ticketId, row, col, seatNo, userId, expireSeconds = 180 }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const expireTime = Date.now() + expireSeconds * 1000;

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.realtimeLock, {
        keys: [statusKey],
        arguments: [String(userId), String(row), String(col), seatNo, String(expireTime)],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 锁定座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 取消单个座位锁定
   */
  async unlockSeat({ ticketId, row, col, userId }) {
    const statusKey = this._getSeatStatusKey(ticketId);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.unlockSingle, {
        keys: [statusKey],
        arguments: [String(userId), String(row), String(col)],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 释放座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 验证座位并批量续期（创建订单时调用）
   */
  async validateAndExtend({ ticketId, seats, userId, orderNo, newExpireSeconds = 600 }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const newExpireTime = Date.now() + newExpireSeconds * 1000;

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.validateAndExtend, {
        keys: [statusKey],
        arguments: [String(userId), orderNo, String(newExpireTime), String(seatKeys.length), ...seatKeys],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 验证续期失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 释放用户所有锁定的座位（换座时调用）
   */
  async releaseAllSeats({ ticketId, userId }) {
    const statusKey = this._getSeatStatusKey(ticketId);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.releaseAll, {
        keys: [statusKey],
        arguments: [String(userId)],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 释放所有座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 确认座位售出（支付成功时调用）
   */
  async confirmSeats({ ticketId, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalSha(this.scriptSha.confirm, {
        keys: [statusKey],
        arguments: [orderNo, String(seatKeys.length), ...seatKeys],
      });

      return JSON.parse(result);
    } catch (error) {
      console.error("[TicketPurchase] 确认座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 初始化票务座位状态
   */
  async initializeSeatStatus(ticketId, seatLayout) {
    const key = this._getSeatStatusKey(ticketId);
    const seatData = {};

    seatLayout.forEach((seat) => {
      const seatKey = `${seat.row}:${seat.col}`;
      seatData[seatKey] = {
        status: 1, // 1-空闲
        userId: null,
        seatNo: seat.seatNo || `${seat.row}排${seat.col}座`,
        lockTime: null,
        expireTime: null,
      };
    });

    let client = null;
    try {
      client = await this.pool.getClient();

      if (Object.keys(seatData).length > 0) {
        for (const [seatKey, data] of Object.entries(seatData)) {
          await client.hSet(key, seatKey, JSON.stringify(data));
        }
      }

      return true;
    } catch (error) {
      console.error("[TicketPurchase] 初始化座位状态失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 获取座位实时状态
   */
  async getSeatStatus(ticketId) {
    const key = this._getSeatStatusKey(ticketId);
    let client = null;

    try {
      client = await this.pool.getClient();
      const allSeats = await client.hGetAll(key);

      if (!allSeats) return null;

      const result = {};
      for (const [field, value] of Object.entries(allSeats)) {
        const [row, col] = field.split(":");
        result[field] = {
          ...JSON.parse(value),
          row: parseInt(row),
          col: parseInt(col),
        };
      }

      return result;
    } catch (error) {
      console.error("[TicketPurchase] 获取座位状态失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 获取用户当前选中的座位
   */
  async getUserSelectedSeats(ticketId, userId) {
    const key = `user:seat:${userId}:seat:status:${ticketId}`;
    const data = await this.getFun(key);
    return data || { seats: [] };
  }
}

module.exports = new TicketPurchaseService();