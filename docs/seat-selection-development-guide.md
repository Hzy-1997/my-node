# 抢票系统选座功能开发文档

## 一、概述

本文档描述如何在现有高并发抢票系统基础上，增加用户选座功能。系统采用 Redis + MQ + 异步数据库同步的架构，选座功能需要在此基础上扩展座位锁定和预占机制。

---

## 二、现有架构分析

### 2.1 当前数据模型

**Ticket 表**（已存在座位相关字段）：

```javascript
// 是否需要选座
isSeat: {
    type: DataTypes.INTEGER, 
    defaultValue: 1,  // 1-不需要选座，2-需要选座
    validate: { isIn: [[1, 2]] }
},
// 关联座位表
seatId: {
    type: DataTypes.INTEGER, 
    allowNull: true,
    references: { model: 'seats', key: 'id' }
}
```

**Seat 表**（已存在）：

```javascript
{
    id: INTEGER,
    seatNumber: STRING,      // 座位编号
    seatName: STRING,        // 座位名称
    rows: JSON,              // 行定义
    cols: JSON,              // 列定义
    seats: JSON,             // 座位布局
    blockedSeats: JSON,      // 已禁用座位
    total: INTEGER,          // 总座位数
    disable: INTEGER,        // 禁用数
    status: INTEGER          // 状态
}
```

**Order 表**（已存在座位字段）：

```javascript
seat: {
    type: DataTypes.STRING,  // 当前为字符串，需要扩展  
    allowNull: false
}
```

### 2.2 现有抢票流程

```
1. 参数校验
2. 检查用户（缓存）
3. 检查重复购买（Redis）
4. 扣减Redis库存（原子操作）
5. 生成订单号
6. 发送订单到MQ
7. 立即返回成功
```

---

## 三、选座功能设计方案

### 3.1 核心设计原则

1. **高性能**：选座校验必须在 Redis 中完成，避免数据库查询
2. **并发安全**：使用 Lua脚本 保证座位操作的原子性
3. **数据一致性**：订单超时未支付时，座位自动释放
4. **可扩展性**：支持多场次的座位管理

### 3.2 锁座时机设计

#### 3.2.1 问题分析

如果只使用简单的锁座机制，会出现以下问题：

```
时间线：
0分钟    用户A点击座位 → 预锁定10分钟
10分钟   预锁定过期，座位释放
13分钟   用户A去支付 → 座位已被用户B抢走 → 数据不一致！
```

#### 3.2.2 解决方案：锁座续期机制

**核心思路**：创建订单时，将预锁定升级为订单锁定，延长锁定时间

| 阶段     | 锁定类型 | 时长   | 触发条件         |
| -------- | -------- | ------ | ---------------- |
| 选座     | 预锁定   | 10分钟 | 点击座位         |
| 下单     | 订单锁定 | 15分钟 | 创建订单（续期） |
| 支付成功 | 确认售出 | 永久   | 支付回调         |

```
用户A                    系统                    用户B
  |                       |                       |
  |--- 点击座位 ---------->|                       |
  |                       |-- 预锁定10分钟 --------|
  |<-- 锁定成功 -----------|                       |
  |                       |                       |
  |--- 9分钟后去支付 ----->|                       |
  |                       |-- 验证预锁定有效 ------|
  |                       |-- 延长锁定到15分钟 ----|  ← 关键！
  |<-- 订单创建成功 -------|                       |
  |                       |                       |
  |--- 13分钟后支付 ------>|
  |                       |-- 座位仍被A锁定 ------|
  |<-- 支付成功 -----------|                       |
  |                       |-- 确认座位售出 --------|
```

---

## 四、Lua 脚本实现（推荐方案）

### 4.1 为什么使用 Lua 脚本

| 特性       | 说明                                   |
| ---------- | -------------------------------------- |
| **原子性** | Lua脚本在Redis单线程执行，天然线程安全 |
| **高性能** | 减少网络往返，一次请求完成多个操作     |
| **无死锁** | 配合过期时间，自动释放                 |
| **可回滚** | 批量操作失败可统一回滚                 |

### 4.2 批量锁定座位脚本

**文件**: `lua/seat_batch_lock.lua`

```lua
-- seat_batch_lock.lua
-- 批量锁定座位，保证原子性操作
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]订单号, ARGV[3]过期时间戳, ARGV[4]座位数量, ARGV[5+]座位列表(row:col格式)

local statusKey = KEYS[1]
local userId = ARGV[1]
local orderNo = ARGV[2]
local expireTime = tonumber(ARGV[3])
local seatCount = tonumber(ARGV[4])
local seats = {}

-- 解析座位列表
for i = 5, #ARGV do
    table.insert(seats, ARGV[i])
end

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 第一步：检查所有座位是否可用
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)

    if not seatData then
        return cjson.encode({
            success = false,
            code = 4001,
            message = '座位 ' .. seatKey .. ' 不存在',
            failedSeat = seatKey
        })
    end

    local seatInfo = cjson.decode(seatData)
    -- 状态: 1-空闲, 2-锁定, 3-已售
    if seatInfo.status ~= 1 then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位 ' .. seatKey .. ' 已被占用',
            failedSeat = seatKey
        })
    end
end

-- 第二步：批量锁定所有座位
for i, seatKey in ipairs(seats) do
    local seatInfo = {
        status = 2,           -- 锁定
        userId = userId,
        orderNo = orderNo,
        lockTime = currentTime,
        expireTime = expireTime
    }
    redis.call('HSET', statusKey, seatKey, cjson.encode(seatInfo))
end

-- 第三步：设置订单座位关联（带过期时间）
local orderSeatKey = 'order:seat:' .. orderNo
local orderSeatData = cjson.encode({
    seats = seats,
    userId = userId,
    lockTime = currentTime,
    expireTime = expireTime
})
local ttlSeconds = math.floor((expireTime - currentTime) / 1000)
redis.call('SET', orderSeatKey, orderSeatData, 'EX', ttlSeconds)

-- 第四步：设置用户选座缓存（防止重复选择）
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
redis.call('SET', userSeatKey, cjson.encode(seats), 'EX', ttlSeconds)

return cjson.encode({
    success = true,
    code = 200,
    lockedCount = #seats,
    lockTime = currentTime,
    expireTime = expireTime
})
```

### 4.3 续期脚本（核心）

**文件**: `lua/seat_extend_lock.lua`

```lua
-- seat_extend_lock.lua
-- 延长座位锁定时间（创建订单时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]旧订单号, ARGV[3]新订单号, ARGV[4]新过期时间戳, ARGV[5]座位数量, ARGV[6+]座位列表

local statusKey = KEYS[1]
local userId = ARGV[1]
local oldOrderNo = ARGV[2]
local newOrderNo = ARGV[3]
local newExpireTime = tonumber(ARGV[4])
local seatCount = tonumber(ARGV[5])
local seats = {}

for i = 6, #ARGV do
    table.insert(seats, ARGV[i])
end

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 验证所有权并续期
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)

    if not seatData then
        return cjson.encode({
            success = false,
            code = 4001,
            message = '座位 ' .. seatKey .. ' 不存在'
        })
    end

    local seatInfo = cjson.decode(seatData)

    -- 验证是否是当前用户锁定
    if seatInfo.userId ~= userId then
        return cjson.encode({
            success = false,
            code = 4003,
            message = '座位 ' .. seatKey .. ' 已被其他用户选择'
        })
    end

    -- 验证座位是否仍被锁定状态
    if seatInfo.status ~= 2 then
        return cjson.encode({
            success = false,
            code = 4004,
            message = '座位 ' .. seatKey .. ' 状态异常'
        })
    end

    -- 更新订单号和过期时间
    seatInfo.orderNo = newOrderNo
    seatInfo.expireTime = newExpireTime
    redis.call('HSET', statusKey, seatKey, cjson.encode(seatInfo))
end

-- 更新订单座位缓存
local orderSeatKey = 'order:seat:' .. newOrderNo
local newOrderSeatData = cjson.encode({
    seats = seats,
    userId = userId,
    expireTime = newExpireTime
})
local newTtlSeconds = math.floor((newExpireTime - currentTime) / 1000)
redis.call('SET', orderSeatKey, newOrderSeatData, 'EX', newTtlSeconds)

-- 删除旧订单缓存
redis.call('DEL', 'order:seat:' .. oldOrderNo)

return cjson.encode({
    success = true,
    code = 200,
    newOrderNo = newOrderNo,
    newExpireTime = newExpireTime,
    newTtlSeconds = newTtlSeconds
})
```

### 4.4 释放座位脚本

**文件**: `lua/seat_release.lua`

```lua
-- seat_release.lua
-- 释放座位锁定
-- 参数: KEYS[1]座位状态key, ARGV[1]订单号, ARGV[2]座位数量, ARGV[3+]座位列表

local statusKey = KEYS[1]
local orderNo = ARGV[1]
local seatCount = tonumber(ARGV[2])
local seats = {}

for i = 3, #ARGV do
    table.insert(seats, ARGV[i])
end

local releasedCount = 0

for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)

    if seatData then
        local seatInfo = cjson.decode(seatData)

        -- 只有当前订单锁定的座位才释放
        if seatInfo.orderNo == orderNo then
            -- 恢复为空闲状态（保留座位编号）
            local newInfo = {
                status = 1,           -- 空闲
                userId = nil,
                orderNo = nil,
                lockTime = nil,
                expireTime = nil
            }
            -- 如果有座位编号，保留
            if seatInfo.seatNo then
                newInfo.seatNo = seatInfo.seatNo
            end
            redis.call('HSET', statusKey, seatKey, cjson.encode(newInfo))
            releasedCount = releasedCount + 1
        end
    end
end

-- 删除订单座位缓存
redis.call('DEL', 'order:seat:' .. orderNo)

return cjson.encode({
    success = true,
    code = 200,
    releasedCount = releasedCount
})
```

### 4.5 确认座位脚本（支付成功）

**文件**: `lua/seat_confirm.lua`

```lua
-- seat_confirm.lua
-- 确认座位售出（支付成功后调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]订单号, ARGV[2]座位数量, ARGV[3+]座位列表

local statusKey = KEYS[1]
local orderNo = ARGV[1]
local seatCount = tonumber(ARGV[2])
local seats = {}

for i = 3, #ARGV do
    table.insert(seats, ARGV[i])
end

local confirmedCount = 0

for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)

    if seatData then
        local seatInfo = cjson.decode(seatData)

        -- 只有当前订单锁定的座位才确认
        if seatInfo.orderNo == orderNo then
            -- 更新为已售状态
            local newInfo = {
                status = 3,           -- 已售
                userId = seatInfo.userId,
                orderNo = orderNo,
                lockTime = seatInfo.lockTime,
                expireTime = nil      -- 永久有效
            }
            if seatInfo.seatNo then
                newInfo.seatNo = seatInfo.seatNo
            end
            redis.call('HSET', statusKey, seatKey, cjson.encode(newInfo))
            confirmedCount = confirmedCount + 1
        end
    end
end

-- 更新订单座位缓存（延长缓存时间）
local orderSeatKey = 'order:seat:' .. orderNo
local orderSeatData = redis.call('GET', orderSeatKey)
if orderSeatData then
    local data = cjson.decode(orderSeatData)
    data.status = 3  -- 已售
    -- 设置较长的过期时间（7天）
    redis.call('SET', orderSeatKey, cjson.encode(data), 'EX', 604800)
end

return cjson.encode({
    success = true,
    code = 200,
    confirmedCount = confirmedCount
})
```

---

## 五、Node.js 服务层封装

**文件**: `services/seatLuaService.js`（新增）

```javascript
/**
 * 选座功能 Lua 脚本服务
 * 使用 Lua 脚本实现高性能、原子性的座位操作
 */
const fs = require("fs");
const path = require("path");
const RedisService = require("./redisService");

class SeatLuaService extends RedisService {
  constructor() {
    super();

    // 加载 Lua 脚本
    this.luaDir = path.join(__dirname, "../lua");
    this.scripts = {
      batchLock: fs.readFileSync(
        path.join(this.luaDir, "seat_batch_lock.lua"),
        "utf8",
      ),
      extendLock: fs.readFileSync(
        path.join(this.luaDir, "seat_extend_lock.lua"),
        "utf8",
      ),
      release: fs.readFileSync(
        path.join(this.luaDir, "seat_release.lua"),
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
        console.log(`[SeatLua] 脚本加载成功: ${name}`);
      }
    } catch (error) {
      console.error("[SeatLua] 脚本加载失败:", error);
    }
  }

  async scriptLoad(script) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.script("LOAD", script);
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  _getSeatStatusKey(ticketId, playDate) {
    return `seat:status:${ticketId}:${playDate}`;
  }

  _getOrderSeatKey(orderNo) {
    return `order:seat:${orderNo}`;
  }

  /**
   * 批量锁定座位
   * @param {Object} params
   * @param {number} params.ticketId - 票务ID
   * @param {string} params.playDate - 场次日期
   * @param {Array} params.seats - 座位列表 [{row, col}]
   * @param {number} params.userId - 用户ID
   * @param {string} params.orderNo - 订单号
   * @param {number} params.expireSeconds - 过期秒数
   */
  async batchLockSeats({
    ticketId,
    playDate,
    seats,
    userId,
    orderNo,
    expireSeconds = 600,
  }) {
    const statusKey = this._getSeatStatusKey(ticketId, playDate);
    const expireTime = Date.now() + expireSeconds * 1000;

    // 座位列表转换为 row:col 格式
    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      // 使用 EVALSHA 执行 Lua 脚本
      const result = await client.evalsha(
        this.scriptSha.batchLock,
        1, // key数量
        statusKey, // KEYS[1]
        String(userId), // ARGV[1]
        orderNo, // ARGV[2]
        expireTime, // ARGV[3]
        seatKeys.length, // ARGV[4]
        ...seatKeys, // ARGV[5+]
      );

      return JSON.parse(result);
    } catch (error) {
      console.error("[SeatLua] 批量锁定失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 续期座位锁定（创建订单时调用）
   */
  async extendLock({
    ticketId,
    playDate,
    seats,
    userId,
    oldOrderNo,
    newOrderNo,
    newExpireSeconds = 900,
  }) {
    const statusKey = this._getSeatStatusKey(ticketId, playDate);
    const newExpireTime = Date.now() + newExpireSeconds * 1000;

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalsha(
        this.scriptSha.extendLock,
        1,
        statusKey,
        String(userId),
        oldOrderNo,
        newOrderNo,
        newExpireTime,
        seatKeys.length,
        ...seatKeys,
      );

      return JSON.parse(result);
    } catch (error) {
      console.error("[SeatLua] 续期失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 释放座位
   */
  async releaseSeats({ ticketId, playDate, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId, playDate);
    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalsha(
        this.scriptSha.release,
        1,
        statusKey,
        orderNo,
        seatKeys.length,
        ...seatKeys,
      );

      return JSON.parse(result);
    } catch (error) {
      console.error("[SeatLua] 释放座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 确认座位（支付成功）
   */
  async confirmSeats({ ticketId, playDate, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId, playDate);
    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalsha(
        this.scriptSha.confirm,
        1,
        statusKey,
        orderNo,
        seatKeys.length,
        ...seatKeys,
      );

      return JSON.parse(result);
    } catch (error) {
      console.error("[SeatLua] 确认座位失败:", error);
      throw error;
    } finally {
      if (client) await this.pool.releaseClient(client);
    }
  }

  /**
   * 初始化场次座位状态
   */
  async initializeSeatStatus(ticketId, playDate, seatLayout) {
    const key = this._getSeatStatusKey(ticketId, playDate);
    const seatData = {};
    const now = Date.now();

    // 将所有座位初始化为空闲状态
    seatLayout.forEach((seat) => {
      const field = `${seat.row}:${seat.col}`;
      seatData[field] = JSON.stringify({
        status: 1, // 空闲
        seatNo: seat.seatNo || `${seat.row}排${seat.col}座`,
        userId: null,
        orderNo: null,
        lockTime: null,
        expireTime: null,
      });
    });

    // 批量设置座位状态
    if (Object.keys(seatData).length > 0) {
      await this.hsetObjFun(key, seatData);
      // 设置过期时间为48小时
      await this.expire(key, 48 * 60 * 60);
    }

    return { success: true, count: Object.keys(seatData).length };
  }

  /**
   * 获取座位实时状态
   */
  async getSeatStatus(ticketId, playDate) {
    const key = this._getSeatStatusKey(ticketId, playDate);
    const allSeats = await this.hgetallFun(key);

    if (!allSeats) return null;

    const result = {};
    for (const [field, value] of Object.entries(allSeats)) {
      const [row, col] = field.split(":");
      result[field] = {
        ...value,
        row: parseInt(row),
        col: parseInt(col),
      };
    }

    return result;
  }
}

module.exports = new SeatLuaService();
```

---

## 六、Redis 数据结构设计

### 6.1 座位状态存储

```
# 座位实时状态 Hash
Key: seat:status:{ticketId}:{playDate}
Field: {row}:{col}  如 "5:8"
Value: {
    "status": 1,        // 1-空闲, 2-锁定, 3-已售
    "userId": null,    // 锁定用户ID
    "orderNo": null,   // 关联订单号
    "lockTime": null,  // 锁定时间戳
    "expireTime": null // 过期时间戳
}

# 示例
HSET seat:status:100:2026-04-15 "5:8" '{"status":2,"userId":123,"orderNo":"TMP001","lockTime":1744252800000,"expireTime":1744253400000}'
```

### 6.2 订单座位关联

```
# 订单座位信息
Key: order:seat:{orderNo}
Value: {
    "seats": [{"row":5,"col":8},{"row":5,"col":9}],
    "userId": 123,
    "lockTime": 1744252800000,
    "expireTime": 1744253400000
}
Expire: 900  (15分钟)
```

### 6.3 用户选座缓存

```
# 用户已选座位
Key: user:seat:{userId}:{ticketId}:{playDate}
Value: ["5:8", "5:9"]
Expire: 600  (10分钟)
```

---

## 七、数据库变更

### 7.1 创建迁移文件

**文件**: `migrations/20260410000000-add-seat-selection-support.js`

```javascript
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 修改 orders 表的 seat 字段为 JSON 类型
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '选座信息，格式: [{row:1, col:2, seatNo:"A1"}]',
    });

    // 2. 添加场次日期字段
    await queryInterface.addColumn("orders", "playDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: "演出/游玩日期",
    });

    // 3. 创建座位锁定记录表
    await queryInterface.createTable("seat_locks", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "票务ID",
      },
      playDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: "场次日期",
      },
      row: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "行号",
      },
      col: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "列号",
      },
      seatNo: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "座位编号",
      },
      orderNo: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "订单号",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "用户ID",
      },
      lockStatus: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: "锁定状态：1-锁定中，2-已确认，3-已释放",
      },
      lockTime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "锁定时间",
      },
      expireTime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "过期时间",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // 添加索引
    await queryInterface.addIndex(
      "seat_locks",
      ["ticketId", "playDate", "row", "col"],
      {
        name: "idx_seat_locks_position",
      },
    );
    await queryInterface.addIndex("seat_locks", ["orderNo"], {
      name: "idx_seat_locks_order",
    });
    await queryInterface.addIndex("seat_locks", ["expireTime"], {
      name: "idx_seat_locks_expire",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.removeColumn("orders", "playDate");
    await queryInterface.dropTable("seat_locks");
  },
};
```

### 7.2 新增数据模型

**文件**: `models/seatModel/seatLock.js`

```javascript
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

const SeatLock = sequelize.define(
  "SeatLock",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "票务ID",
    },
    playDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "场次日期",
    },
    row: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "行号",
    },
    col: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "列号",
    },
    seatNo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "座位编号",
    },
    orderNo: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "订单号",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "用户ID",
    },
    lockStatus: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: "锁定状态：1-锁定中，2-已确认，3-已释放",
    },
    lockTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "锁定时间",
    },
    expireTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "过期时间",
    },
  },
  {
    tableName: "seat_locks",
    timestamps: true,
    indexes: [
      { fields: ["ticketId", "playDate", "row", "col"] },
      { fields: ["orderNo"] },
      { fields: ["expireTime"] },
    ],
  },
);

module.exports = { SeatLock };
```

---

## 八、API 接口设计

### 8.1 获取座位图及实时状态

**接口**: `GET /api/ticket/seats/:ticketId`

```javascript
/**
 * 获取座位图及实时状态
 */
exports.getSeatMap = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { playDate } = req.query;

    if (!ticketId || !playDate) {
      return res.json(util.fail("参数不完整"));
    }

    // 获取票务和座位信息
    const ticket = await Ticket.findOne({
      where: { id: ticketId },
      include: [{ model: Seat, as: "seatInfo" }],
    });

    if (!ticket || ticket.isSeat !== 2 || !ticket.seatId) {
      return res.json(util.fail("该票务不需要选座"));
    }

    const seatConfig = ticket.seatInfo;

    // 从 Redis 获取实时座位状态
    let seatStatus = await seatLuaService.getSeatStatus(ticketId, playDate);

    // 如果 Redis 中没有，初始化座位状态
    if (!seatStatus) {
      const seatLayout = JSON.parse(seatConfig.seats || "[]");
      await seatLuaService.initializeSeatStatus(ticketId, playDate, seatLayout);
      seatStatus = await seatLuaService.getSeatStatus(ticketId, playDate);
    }

    // 组装座位图数据
    const layout = JSON.parse(seatConfig.seats || "[]").map((seat) => {
      const key = `${seat.row}:${seat.col}`;
      const status = seatStatus[key] || { status: 1 };
      const blockedSeats = JSON.parse(seatConfig.blockedSeats || "[]");
      const isBlocked = blockedSeats.some(
        (b) => b.row === seat.row && b.col === seat.col,
      );

      return {
        row: seat.row,
        col: seat.col,
        seatNo: seat.seatNo || `${seat.row}排${seat.col}座`,
        status: isBlocked ? 4 : status.status,
        type: seat.type || "normal",
      };
    });

    return res.json(
      util.success("获取成功", {
        seatMap: {
          rows: seatConfig.rows,
          cols: seatConfig.cols,
          seatName: seatConfig.seatName,
          layout: layout,
        },
        price: ticket.price,
        playDate: playDate,
      }),
    );
  } catch (error) {
    console.error("获取座位图失败:", error);
    return res.json(util.fail("获取失败", error.message));
  }
};
```

### 8.2 锁定座位

**接口**: `POST /api/ticket/seats/lock`

```javascript
/**
 * 锁定座位（预锁定，10分钟）
 */
exports.lockSeats = async (req, res) => {
  try {
    const { ticketId, playDate, seats, userId } = req.body;

    if (
      !ticketId ||
      !playDate ||
      !seats ||
      !Array.isArray(seats) ||
      seats.length === 0 ||
      !userId
    ) {
      return res.json(util.fail("参数不完整"));
    }

    // 获取票务信息
    const ticket = await Ticket.findOne({
      where: { id: ticketId },
      attributes: ["id", "isSeat", "maxPurchaseQuantity", "price"],
    });

    if (!ticket || ticket.isSeat !== 2) {
      return res.json(util.fail("该票务不需要选座"));
    }

    // 检查购买数量限制
    if (
      ticket.maxPurchaseQuantity > 0 &&
      seats.length > ticket.maxPurchaseQuantity
    ) {
      return res.json(
        util.fail(`单次最多选择${ticket.maxPurchaseQuantity}个座位`),
      );
    }

    // 生成预订单号
    const tempOrderNo = await util.generateOrderNo("TMP");

    // 使用 Lua 脚本锁定座位（10分钟）
    const lockResult = await seatLuaService.batchLockSeats({
      ticketId,
      playDate,
      seats,
      userId,
      orderNo: tempOrderNo,
      expireSeconds: 600, // 10分钟
    });

    if (!lockResult.success) {
      return res.json(util.fail(lockResult.message, { code: lockResult.code }));
    }

    return res.json(
      util.success("锁定成功", {
        lockId: tempOrderNo,
        lockedSeats: seats,
        expireTime: lockResult.expireTime,
        expireSeconds: 600,
      }),
    );
  } catch (error) {
    console.error("锁定座位失败:", error);
    return res.json(util.fail("锁定失败", error.message));
  }
};
```

### 8.3 释放座位

**接口**: `POST /api/ticket/seats/unlock`

```javascript
/**
 * 释放座位
 */
exports.unlockSeats = async (req, res) => {
  try {
    const { ticketId, playDate, lockId, seats } = req.body;

    if (!ticketId || !playDate || !lockId || !seats) {
      return res.json(util.fail("参数不完整"));
    }

    await seatLuaService.releaseSeats({
      ticketId,
      playDate,
      seats,
      orderNo: lockId,
    });

    return res.json(util.success("释放成功"));
  } catch (error) {
    console.error("释放座位失败:", error);
    return res.json(util.fail("释放失败", error.message));
  }
};
```

---

## 九、修改抢票流程支持选座

### 9.1 修改 createOrder 方法

**文件**: `routes/managementSystem/payment/seckillPayment.js`

```javascript
const seatLuaService = require("../../../services/seatLuaService");

/**
 * 高并发抢票 - 创建订单（支持选座）
 */
exports.createOrder = async (req, res) => {
  const startTime = Date.now();
  const { goodsId, userId, count, playDate, seats, lockId } = req.body;

  if (!goodsId || !userId || !count) {
    return res.json(util.fail("系统错误！"));
  }

  try {
    // 获取票务信息
    const ticketInfo = await Ticket.findOne({
      where: { id: goodsId },
      attributes: [
        "id",
        "remainingStock",
        "stock",
        "maxPurchaseQuantity",
        "stockResetType",
        "startTime",
        "saleEndDate",
        "memberLevel",
        "onlineTime",
        "saleStartDate",
        "isSeat",
        "price",
        "seatId",
      ],
    });

    if (!ticketInfo) {
      return res.json(util.fail("商品不存在"));
    }

    // ========== 选座模式处理 ==========
    let selectedSeats = null;
    let formalOrderNo = null;

    if (ticketInfo.isSeat === 2) {
      if (!playDate || !seats || !Array.isArray(seats) || seats.length === 0) {
        return res.json(util.fail("请选择座位和场次日期"));
      }

      if (seats.length !== count) {
        return res.json(util.fail("选择座位数量与购买数量不匹配"));
      }

      // 生成正式订单号
      formalOrderNo = await util.generateOrderNo("ORD");

      // 【关键】续期座位锁定（从10分钟延长到15分钟）
      const extendResult = await seatLuaService.extendLock({
        ticketId: goodsId,
        playDate,
        seats,
        userId,
        oldOrderNo: lockId, // 预订单号
        newOrderNo: formalOrderNo, // 正式订单号
        newExpireSeconds: 900, // 15分钟
      });

      if (!extendResult.success) {
        return res.json(util.fail(extendResult.message));
      }

      selectedSeats = seats;
    }

    // 用户检查、会员等级检查、时间检查...
    // ... (原有逻辑)

    // 扣减 Redis 库存
    const stockResult = await redisService.checkAndDecreaseStock(
      goodsId,
      count,
    );
    if (!stockResult.success) {
      // 回滚座位锁定
      if (formalOrderNo) {
        await seatLuaService.releaseSeats({
          ticketId: goodsId,
          playDate,
          seats: selectedSeats,
          orderNo: formalOrderNo,
        });
      }
      return res.json(util.fail("库存不足"));
    }

    // 生成订单号
    const orderNo = formalOrderNo || (await util.generateOrderNo("ORD"));

    // 构建订单数据
    const orderData = {
      orderNumber: orderNo,
      goodsId: goodsId,
      memberId: userId,
      userName: user.userName,
      userIdCard: user.idCard,
      userPhone: user.phone,
      buyNum: count,
      orderStatus: 1,
      verifyStatus: 1,
      createTime: new Date().toISOString(),
      playDate: playDate || null,
      seat: selectedSeats ? JSON.stringify(selectedSeats) : null,
      title: ticketInfo.title,
      ticketType: ticketInfo.ticketType,
      ticketPrice: ticketInfo.price,
      orderAmount: (parseFloat(ticketInfo.price) * count).toFixed(2),
    };

    // 发送订单到 MQ
    await queueService.addOrderJob({
      ...orderData,
      rollbackStock: true,
      isSeatOrder: ticketInfo.isSeat === 2,
      seatInfo: selectedSeats
        ? {
            seats: selectedSeats,
            playDate: playDate,
            expireTime: Date.now() + 900 * 1000,
          }
        : null,
    });

    // 发送库存同步任务
    await queueService.addStockSyncJob({
      goodsId: goodsId,
      count: count,
      operation: "decrease",
      orderNo: orderNo,
    });

    // 发送延迟取消任务
    await queueService.addCancelJob({
      orderNo: orderNo,
      goodsId: goodsId,
      userId: userId,
      count: count,
      reason: "超时未支付",
      isSeatOrder: ticketInfo.isSeat === 2,
      seatInfo: selectedSeats ? { seats: selectedSeats, playDate } : null,
    });

    const processTime = Date.now() - startTime;

    res.json(
      util.success("订单创建成功，请尽快支付", {
        orderNo: orderNo,
        processTime: processTime,
        expireTimeText: Date.now() + 15 * 60 * 1000,
        seats: selectedSeats,
      }),
    );
  } catch (error) {
    console.error("[Seckill] 抢单失败:", error);
    return res.json(util.fail("抢单失败", error.message));
  }
};
```

---

## 十、支付回调处理

### 10.1 支付成功

```javascript
/**
 * 处理支付成功
 */
async function handlePaymentSuccess(orderNo) {
  try {
    const order = await Order.findOne({
      where: { orderNumber: orderNo },
    });

    if (!order) {
      throw new Error("订单不存在");
    }

    // 更新订单状态
    await Order.update(
      { orderStatus: 2 }, // 待核销
      { where: { orderNumber: orderNo } },
    );

    // 如果是选座订单，确认座位
    if (order.seat && order.playDate) {
      const seats =
        typeof order.seat === "string" ? JSON.parse(order.seat) : order.seat;

      await seatLuaService.confirmSeats({
        ticketId: order.goodsId,
        playDate: order.playDate,
        seats: seats,
        orderNo: orderNo,
      });

      // 更新数据库座位锁定记录
      const { SeatLock } = require("../models/Summary");
      await SeatLock.update({ lockStatus: 2 }, { where: { orderNo: orderNo } });

      console.log(`[Payment] 选座订单 ${orderNo} 座位已确认`);
    }
  } catch (error) {
    console.error("[Payment] 处理支付成功失败:", error);
    throw error;
  }
}
```

### 10.2 订单取消（超时）

```javascript
/**
 * 处理订单取消
 */
async function handleOrderCancel(orderNo, cancelReason) {
  try {
    const order = await Order.findOne({
      where: { orderNumber: orderNo },
    });

    if (!order || order.orderStatus !== 1) {
      return { success: false, message: "订单状态不允许取消" };
    }

    // 更新订单状态
    await Order.update(
      { orderStatus: 3, verifyStatus: 3 },
      { where: { orderNumber: orderNo } },
    );

    // 恢复库存
    await redisService.incrFun(`ticket:stock:${order.goodsId}`, order.buyNum);

    // 如果是选座订单，释放座位
    if (order.seat && order.playDate) {
      const seats =
        typeof order.seat === "string" ? JSON.parse(order.seat) : order.seat;

      await seatLuaService.releaseSeats({
        ticketId: order.goodsId,
        playDate: order.playDate,
        seats: seats,
        orderNo: orderNo,
      });

      // 更新数据库座位锁定记录
      const { SeatLock } = require("../models/Summary");
      await SeatLock.update({ lockStatus: 3 }, { where: { orderNo: orderNo } });

      console.log(`[Cancel] 选座订单 ${orderNo} 座位已释放`);
    }

    return { success: true };
  } catch (error) {
    console.error("[Cancel] 处理订单取消失败:", error);
    throw error;
  }
}
```

---

## 十一、定时任务

### 11.1 座位锁定过期清理

**文件**: `cron/seatLockCleanup.js`

```javascript
/**
 * 座位锁定过期清理任务
 * 每分钟执行一次，清理过期的座位锁定
 */
const { SeatLock } = require("../models/Summary");
const seatLuaService = require("../services/seatLuaService");

async function cleanupExpiredSeatLocks() {
  console.log("[SeatLockCleanup] 开始清理过期座位锁定...");

  try {
    // 查找已过期的锁定记录
    const expiredLocks = await SeatLock.findAll({
      where: {
        lockStatus: 1, // 锁定中
        expireTime: { [Op.lt]: new Date() },
      },
    });

    console.log(`[SeatLockCleanup] 发现 ${expiredLocks.length} 条过期记录`);

    // 按订单号分组
    const orderGroup = {};
    for (const lock of expiredLocks) {
      if (!orderGroup[lock.orderNo]) {
        orderGroup[lock.orderNo] = {
          ticketId: lock.ticketId,
          playDate: lock.playDate,
          seats: [],
        };
      }
      orderGroup[lock.orderNo].seats.push({
        row: lock.row,
        col: lock.col,
      });
    }

    // 批量释放座位
    for (const [orderNo, data] of Object.entries(orderGroup)) {
      try {
        await seatLuaService.releaseSeats({
          ticketId: data.ticketId,
          playDate: data.playDate,
          seats: data.seats,
          orderNo: orderNo,
        });

        // 更新数据库记录
        await SeatLock.update(
          { lockStatus: 3 },
          { where: { orderNo: orderNo, lockStatus: 1 } },
        );

        console.log(
          `[SeatLockCleanup] 释放订单 ${orderNo} 的 ${data.seats.length} 个座位`,
        );
      } catch (error) {
        console.error(`[SeatLockCleanup] 释放座位失败:`, error);
      }
    }

    console.log("[SeatLockCleanup] 清理完成");
  } catch (error) {
    console.error("[SeatLockCleanup] 清理任务失败:", error);
  }
}

// 每分钟执行一次
setInterval(cleanupExpiredSeatLocks, 60 * 1000);

module.exports = { cleanupExpiredSeatLocks };
```

---

## 十二、前端交互流程

### 12.1 选座流程图

```
用户进入购票页面
    ↓
判断是否需要选座 (isSeat === 2)
    ↓ 是
调用 GET /api/ticket/seats/:ticketId?playDate=xxx
    ↓
渲染座位图
    ↓
用户选择座位
    ↓
调用 POST /api/ticket/seats/lock 预锁定（10分钟）
    ↓
锁定成功，开始倒计时
    ↓
用户点击"去支付"
    ↓
调用 POST /api/payment/createOrder
    ↓
系统续期座位（延长到15分钟）
    ↓
订单创建成功，进入支付页面
    ↓
支付成功/超时取消
    ↓
确认座位/释放座位
```

### 12.2 前端关键代码

```javascript
// 选座组件核心逻辑
const SeatSelector = {
  data() {
    return {
      selectedSeats: [],
      lockId: null,
      expireTime: null,
      countdown: 0,
      timer: null,
    };
  },

  methods: {
    // 点击座位
    async onSeatClick(seat) {
      if (seat.status !== 1) return;

      const isSelected = this.selectedSeats.some(
        (s) => s.row === seat.row && s.col === seat.col,
      );

      if (isSelected) {
        // 取消选择
        this.selectedSeats = this.selectedSeats.filter(
          (s) => !(s.row === seat.row && s.col === seat.col),
        );
        await this.refreshLock();
      } else {
        // 添加选择
        if (this.selectedSeats.length >= this.maxSelect) {
          this.$message.warning(`最多选择${this.maxSelect}个座位`);
          return;
        }
        this.selectedSeats.push({ row: seat.row, col: seat.col });
        await this.lockSeats();
      }
    },

    // 锁定座位
    async lockSeats() {
      try {
        const res = await api.lockSeats({
          ticketId: this.ticketId,
          playDate: this.playDate,
          seats: this.selectedSeats,
          userId: this.userId,
        });

        if (res.code === 200) {
          this.lockId = res.data.lockId;
          this.expireTime = res.data.expireTime;
          this.startCountdown();
        } else {
          this.$message.error(res.message);
          this.refreshSeatMap();
        }
      } catch (error) {
        console.error("锁定座位失败:", error);
      }
    },

    // 刷新锁定（座位变化时重新锁定）
    async refreshLock() {
      if (this.selectedSeats.length === 0) {
        // 释放所有座位
        if (this.lockId) {
          await api.unlockSeats({
            ticketId: this.ticketId,
            playDate: this.playDate,
            lockId: this.lockId,
            seats: this.selectedSeats,
          });
          this.lockId = null;
        }
        return;
      }
      await this.lockSeats();
    },

    // 创建订单（续期座位）
    async createOrder() {
      try {
        const res = await api.createOrder({
          goodsId: this.ticketId,
          userId: this.userId,
          count: this.selectedSeats.length,
          playDate: this.playDate,
          seats: this.selectedSeats,
          lockId: this.lockId,
        });

        if (res.code === 200) {
          // 更新过期时间（15分钟）
          this.expireTime = res.data.expireTime;
          // 跳转到支付页面
          this.$router.push({
            path: "/payment",
            query: { orderNo: res.data.orderNo },
          });
        } else {
          this.$message.error(res.message);
        }
      } catch (error) {
        console.error("创建订单失败:", error);
      }
    },

    // 倒计时
    startCountdown() {
      this.stopCountdown();
      this.countdown = Math.max(0, this.expireTime - Date.now());

      this.timer = setInterval(() => {
        this.countdown = Math.max(0, this.expireTime - Date.now());

        if (this.countdown <= 0) {
          this.stopCountdown();
          this.$message.warning("座位锁定已过期，请重新选择");
          this.selectedSeats = [];
          this.lockId = null;
          this.refreshSeatMap();
        }
      }, 1000);
    },

    stopCountdown() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
  },

  template: `
        <div class="seat-selector">
            <div class="seat-map">
                <div v-for="seat in seatLayout" :key="seat.key"
                     :class="['seat', getSeatClass(seat)]"
                     @click="onSeatClick(seat)">
                </div>
            </div>

            <div class="selected-info">
                <div>已选座位: {{ selectedSeats.map(s => s.row + '排' + s.col + '座').join(', ') }}</div>
                <div class="countdown" :class="{ warning: countdown < 180000 }">
                    座位保留: {{ formatTime(countdown) }}
                </div>
            </div>

            <Button type="primary" :disabled="selectedSeats.length === 0" @click="createOrder">
                去支付
            </Button>
        </div>
    `,
};
```

---

## 十三、安全与性能优化

### 13.1 防刷措施

```javascript
// 1. 选座频率限制
const LOCK_RATE_LIMIT = {
  maxPerMinute: 10,
  key: "rate:seat:lock:",
};

// 2. 单用户最大锁座数量
const MAX_LOCK_PER_USER = 4;

// 3. 最大未支付订单数
const MAX_UNPAID_ORDERS = 2;
```

### 13.2 性能优化

1. **Lua 脚本**：减少网络往返，保证原子性
2. **本地缓存**：座位图配置使用本地缓存
3. **WebSocket**：实时推送座位状态变化
4. **批量操作**：减少 Redis 调用次数

### 13.3 错误码定义

| 错误码 | 说明                 |
| ------ | -------------------- |
| 4001   | 座位不存在           |
| 4002   | 座位已被选择         |
| 4003   | 座位已被其他用户选择 |
| 4004   | 座位状态异常或已过期 |

---

## 十四、测试要点

### 14.1 单元测试

1. Lua 脚本原子性测试
2. 并发锁座冲突场景
3. 续期逻辑正确性
4. 超时释放场景

### 14.2 集成测试

1. 完整购票流程
2. 多人同时选择同一座位
3. 支付失败座位释放
4. 系统重启数据恢复

### 14.3 压力测试

1. 1000 并发选座请求
2. 座位状态查询 QPS
3. Lua 脚本执行性能

---

## 十五、部署检查清单

- [ ] 创建 lua 目录并上传 Lua 脚本
- [ ] 执行数据库迁移脚本
- [ ] 部署 seatLuaService.js
- [ ] 更新 seckillPayment.js
- [ ] 配置定时清理任务
- [ ] 测试座位锁定流程
- [ ] 测试支付回调处理
- [ ] 监控 Lua 脚本执行指标

---

## 十六、相关文件清单

```
新增文件:
├── lua/
│   ├── seat_batch_lock.lua      # 批量锁定
│   ├── seat_extend_lock.lua      # 续期锁定
│   ├── seat_release.lua         # 释放座位
│   └── seat_confirm.lua         # 确认座位
├── migrations/20260410000000-add-seat-selection-support.js
├── models/seatModel/seatLock.js
├── services/seatLuaService.js
├── cron/seatLockCleanup.js
└── docs/seat-selection-development-guide.md

修改文件:
├── models/Summary.js
├── models/orderModel/index.js
├── routes/managementSystem/payment/seckillPayment.js
├── routes/mobileApp/ticketingRouter/ticketing.js
└── workers/orderWorker.js
```
