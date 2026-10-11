# 抢票系统选座功能开发文档 V2

## 一、概述

本文档描述如何在现有高并发抢票系统基础上，增加用户选座功能。采用**实时锁座模式**（类似大麦/猫眼），用户点击座位立即锁定，支持多人同时选座。

### 业务场景

| 票务类型     | 示例          | 特点               |
| ------------ | ------------- | ------------------ |
| **无需选座** | 景区大门门票  | 只扣库存，不选位置 |
| **需要选座** | 室内剧场/影院 | 实时选座 + 扣库存  |

### 核心设计原则

1. **实时锁座**：用户点击座位立即锁定（3分钟），类似大麦
2. **并发安全**：使用 Lua 脚本保证座位操作的原子性
3. **数据一致性**：订单超时未支付时，座位自动释放
4. **简单易用**：一个票务 = 一个场次，无需选择日期

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
// 关联座位表（场馆ID）
seatId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'seats', key: 'id' }
}
```

**Seat 表**（已存在，存储场馆座位布局）：

```javascript
{
    id: INTEGER,
    seatNumber: STRING,      // 场馆编号
    seatName: STRING,        // 场馆名称
    rows: JSON,              // 行定义
    cols: JSON,              // 列定义
    seats: JSON,             // 座位布局数组
    blockedSeats: JSON,      // 已禁用座位
    total: INTEGER,          // 总座位数
    disable: INTEGER,        // 禁用数
    status: INTEGER          // 状态
}
```

**Order 表**（需要修改 seat 字段）：

```javascript
seat: {
    type: DataTypes.JSON,    // 从 STRING 改为 JSON
    allowNull: true,
    comment: '选座信息，格式: [{row:1, col:2, seatNo:"A1"}]'
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

### 3.1 实时锁座模式（大麦模式）

**核心流程：**

```
用户操作时间线：

0秒    用户点击座位A → 前端请求后端 → 后端锁座3分钟
30秒   用户点击座位B → 前端请求后端 → 后端锁座3分钟
60秒   用户点击座位C → 前端请求后端 → 后端锁座3分钟

3分钟  座位A锁定过期释放（如果用户还没下单）
       座位B还有2分钟
       座位C还有2分钟

用户点击下单 → 验证所有选中座位是否仍被锁定
            → 创建订单，所有座位延长到10分钟（和订单一致）
```

**关键特点：**

| 特点     | 说明                               |
| -------- | ---------------------------------- |
| 实时锁定 | 点一个座位锁一个，立即反馈         |
| 独立计时 | 每个座位锁定时间独立计算           |
| 下单续期 | 下单后统一延长到订单过期时间       |
| 换座重选 | 不支持单个取消，只能全部放弃重新选 |

### 3.2 锁座时间设计

| 阶段      | 锁定类型 | 时长   | 触发条件             |
| --------- | -------- | ------ | -------------------- |
| 选座      | 预锁定   | 3分钟  | 点击座位             |
| 下单      | 订单锁定 | 10分钟 | 创建订单（统一延长） |
| 支付成功  | 确认售出 | 永久   | 支付回调             |
| 超时/取消 | 释放     | -      | 订单取消或过期       |

**注意：**

- 每个座位独立计时（3分钟）
- 下单时检查所有座位是否有效（剩余时间 > 30秒）
- 下单后统一延长到10分钟（和订单支付时间一致）

### 3.3 选座过程中的操作

**选座阶段（未下单前）：**

```
用户选了座位A、B、C：
- 点击座位A → 取消A的锁定
- 点击座位D → 锁定D（现在选中B、C、D）
- 灵活操作，可以单个添加/取消
```

**去支付阶段（已创建订单后）：**

```
用户已下单，进入支付页面：
- 不能修改座位
- 如果想换座位，必须取消整个订单
- 取消后回到选座页面，全部重新开始
```

**关键点：**

- **选座过程中**：可以单个添加/取消座位（灵活）
- **下单后**：不能修改座位，只能取消订单重新开始

---

## 四、统一 Lua 脚本架构

### 4.1 为什么统一使用 Lua

| 特性           | 分布式锁方式        | Lua 脚本方式           |
| -------------- | ------------------- | ---------------------- |
| **原子性**     | 需要多次 Redis 操作 | 单次执行，天然原子     |
| **性能**       | 多次网络往返        | 一次请求完成           |
| **并发能力**   | 受锁竞争影响        | 单线程队列执行，无竞争 |
| **代码复杂度** | 需要管理锁生命周期  | 无需锁管理             |
| **2万并发**    | 可能超时/失败       | ✅ 可支持              |

**Redis Lua 脚本性能：**

- 单节点 QPS：10万+
- 2万人同时抢购：轻松支持
- 执行时间：毫秒级

### 4.2 Lua 脚本列表

| 脚本                           | 用途                 | 场景          |
| ------------------------------ | -------------------- | ------------- |
| `ticket_purchase.lua`          | 普通抢票（无需选座） | 景区大门门票  |
| `ticket_purchase_seat.lua`     | 选座抢票（需要选座） | 室内剧场/影院 |
| `seat_realtime_lock.lua`       | 实时锁定单个座位     | 用户点击座位  |
| `seat_unlock_single.lua`       | 取消单个座位         | 用户取消选择  |
| `seat_validate_and_extend.lua` | 验证并批量续期       | 创建订单时    |
| `seat_release_all.lua`         | 释放所有座位         | 订单取消/超时 |
| `seat_confirm.lua`             | 确认座位售出         | 支付成功      |

### 4.3 Lua 脚本注意事项

#### 4.3.1 阻塞问题

Redis 是单线程的，Lua 脚本执行期间会阻塞其他命令：

```
Redis 单线程
    ↓
Lua 脚本执行（阻塞）
    ↓
其他命令排队等待
```

**风险示例（避免）：**

```lua
-- 危险：遍历大量数据
for i = 1, 100000 do  -- 循环10万次！
    redis.call('HGET', 'seat:status:100', i)
end
-- 这会阻塞 Redis 数秒！
```

**我们的脚本（安全）：**
| 脚本 | 操作数据量 | 执行时间 | 风险 |
|------|-----------|---------|------|
| `ticket_purchase.lua` | 1个key | < 5ms | ✅ 安全 |
| `ticket_purchase_seat.lua` | 最多几十个座位 | < 10ms | ✅ 安全 |
| `seat_realtime_lock.lua` | 1个座位 | < 3ms | ✅ 安全 |

#### 4.3.2 优化建议

1. **限制单次操作数量**

```javascript
// 后端限制
if (seats.length > 10) {
  return res.json(util.fail("单次最多选择10个座位"));
}
```

2. **监控脚本执行时间**

```javascript
const start = Date.now();
const result = await client.evalsha(...);
console.log(`Lua执行时间: ${Date.now() - start}ms`);
// 超过 50ms 需要告警
```

3. **避免在 Lua 中做复杂计算**

```lua
-- 好的做法：简单判断 + 操作
if seatInfo.status == 2 then
    redis.call('HSET', key, field, value)
end

-- 避免：复杂逻辑、大量计算
```

#### 4.3.3 2万并发场景下的表现

```
场景：2万人同时抢票

Redis 单线程处理：
- 每个 Lua 脚本：1-5ms
- QPS：10万+
- 2万请求在 200ms 内完成
- 平均等待：10ms

结论：Lua 脚本适合我们的场景
```

---

## 五、Redis 数据结构设计

### 5.1 普通抢票数据存储

```
# 票库存
Key: ticket:stock:{ticketId}
Value: 100  (整数)

# 用户购买记录（防重复购买）
Key: purchase:{userId}:{ticketId}
Value: {count: 2, orderNo: "ORD001", time: 1744252800000}
Expire: 86400  (24小时)
```

### 5.2 选座抢票数据存储

#### 5.2.1 座位实时状态

```
# 座位实时状态 Hash
Key: seat:status:{ticketId}
Field: {row}:{col}  如 "5:8"
Value: {
    "status": 1,        // 1-空闲, 2-锁定, 3-已售
    "userId": 123,     // 锁定用户ID
    "seatNo": "5排8座", // 座位名称
    "lockTime": 1744252800000,  // 锁定时间戳
    "expireTime": 1744252980000 // 过期时间戳（3分钟后）
}

#### 5.2.2 用户已选座位缓存

```

# 用户当前选中的座位（用于快速查询）

Key: user:seat:{userId}:{ticketId}
Value: {
"seats": [{"row":5,"col":8},{"row":5,"col":9}],
"lockTime": 1744252800000,
"expireTime": 1744252980000
}
Expire: 180 (3分钟，和座位锁定时间一致)

```

#### 5.2.3 订单座位关联

```

# 订单创建后，记录订单关联的座位

Key: order:seat:{orderNo}
Value: {
"ticketId": 100,
"seats": [{"row":5,"col":8},{"row":5,"col":9}],
"userId": 123,
"status": 2 // 1-预锁定, 2-订单锁定, 3-已确认
}
Expire: 600 (10分钟，和订单过期时间一致)

````

---

## 六、Lua 脚本实现

### 6.1 普通抢票脚本（无需选座）

**文件**: `lua/ticket_purchase.lua`

```lua
-- ticket_purchase.lua
-- 普通抢票（无需选座）
-- 参数: KEYS[1]库存key, KEYS[2]用户购买记录key, ARGV[1]用户ID, ARGV[2]购买数量, ARGV[3]订单号, ARGV[4]过期时间戳

local stockKey = KEYS[1]
local purchaseKey = KEYS[2]
local userId = ARGV[1]
local quantity = tonumber(ARGV[2])
local orderNo = ARGV[3]
local expireTime = tonumber(ARGV[4])

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 检查是否已购买（防重复购买）
local hasPurchased = redis.call('GET', purchaseKey)
if hasPurchased then
    local purchaseInfo = cjson.decode(hasPurchased)
    return cjson.encode({
        success = false,
        code = 4001,
        message = '您已经购买过该票务'
    })
end

-- 检查库存
local stock = redis.call('GET', stockKey)
if not stock then
    return cjson.encode({
        success = false,
        code = 4002,
        message = '库存未初始化'
    })
end

local currentStock = tonumber(stock)
if currentStock < quantity then
    return cjson.encode({
        success = false,
        code = 4003,
        message = '库存不足'
    })
end

-- 扣减库存
local newStock = redis.call('DECRBY', stockKey, quantity)

-- 记录用户购买
local purchaseInfo = {
    userId = userId,
    orderNo = orderNo,
    count = quantity,
    time = currentTime
}
redis.call('SET', purchaseKey, cjson.encode(purchaseInfo), 'EX', 86400)

return cjson.encode({
    success = true,
    code = 200,
    orderNo = orderNo,
    newStock = tonumber(newStock),
    message = '抢购成功'
})
```

### 6.2 选座抢票脚本（需要选座）

**文件**: `lua/ticket_purchase_seat.lua`

```lua
-- ticket_purchase_seat.lua
-- 选座抢票（需要选座）
-- 参数: KEYS[1]座位状态key, KEYS[2]用户购买记录key, ARGV[1]用户ID, ARGV[2]订单号, ARGV[3]过期时间戳, ARGV[4]座位数量, ARGV[5+]座位列表(row:col格式)

local statusKey = KEYS[1]
local purchaseKey = KEYS[2]
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

-- 检查是否已购买（防重复购买）
local hasPurchased = redis.call('GET', purchaseKey)
if hasPurchased then
    return cjson.encode({
        success = false,
        code = 4001,
        message = '您已经购买过该票务'
    })
end

-- 第一步：检查所有座位是否被当前用户锁定且有效
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)

    if not seatData then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位 ' .. seatKey .. ' 不存在',
            failedSeat = seatKey
        })
    end

    local seatInfo = cjson.decode(seatData)

    -- 验证是否是当前用户锁定
    if seatInfo.userId ~= userId then
        return cjson.encode({
            success = false,
            code = 4003,
            message = '座位 ' .. seatKey .. ' 已被其他用户选择',
            failedSeat = seatKey
        })
    end

    -- 验证座位是否仍被锁定
    if seatInfo.status ~= 2 then
        return cjson.encode({
            success = false,
            code = 4004,
            message = '座位 ' .. seatKey .. ' 状态异常',
            failedSeat = seatKey
        })
    end

    -- 验证是否快过期（少于30秒）
    if seatInfo.expireTime - currentTime < 30000 then
        return cjson.encode({
            success = false,
            code = 4005,
            message = '座位 ' .. seatKey .. ' 即将过期，请重新选择',
            failedSeat = seatKey
        })
    end
end

-- 第二步：将所有座位更新为订单锁定状态（延长到10分钟）
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)
    local seatInfo = cjson.decode(seatData)

    seatInfo.orderNo = orderNo
    seatInfo.expireTime = expireTime
    redis.call('HSET', statusKey, seatKey, cjson.encode(seatInfo))
end

-- 第三步：创建订单座位关联
local orderSeatKey = 'order:seat:' .. orderNo
local orderSeatData = cjson.encode({
    ticketId = statusKey:match('seat:status:(%d+)'),
    seats = seats,
    userId = userId,
    status = 2,
    lockTime = currentTime,
    expireTime = expireTime
})
local ttlSeconds = math.floor((expireTime - currentTime) / 1000)
redis.call('SET', orderSeatKey, orderSeatData, 'EX', ttlSeconds)

-- 第四步：记录用户购买
local purchaseInfo = {
    userId = userId,
    orderNo = orderNo,
    count = seatCount,
    time = currentTime
}
redis.call('SET', purchaseKey, cjson.encode(purchaseInfo), 'EX', 86400)

-- 第五步：删除用户选座缓存（已转为订单）
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
redis.call('DEL', userSeatKey)

return cjson.encode({
    success = true,
    code = 200,
    orderNo = orderNo,
    seatCount = seatCount,
    expireTime = expireTime,
    message = '抢购成功'
})
```

### 6.3 实时锁定单个座位脚本

**文件**: `lua/seat_realtime_lock.lua`

```lua
-- seat_realtime_lock.lua
-- 实时锁定单个座位（用户点击座位时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]行号, ARGV[3]列号, ARGV[4]座位名称, ARGV[5]过期时间戳

local statusKey = KEYS[1]
local userId = ARGV[1]
local row = ARGV[2]
local col = ARGV[3]
local seatNo = ARGV[4]
local expireTime = tonumber(ARGV[5])
local seatKey = row .. ':' .. col

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 检查座位当前状态
local seatData = redis.call('HGET', statusKey, seatKey)

if seatData then
    local seatInfo = cjson.decode(seatData)

    -- 检查是否已被其他用户锁定
    if seatInfo.status == 2 then
        -- 检查锁定是否已过期
        if seatInfo.expireTime and seatInfo.expireTime > currentTime then
            return cjson.encode({
                success = false,
                code = 4003,
                message = '座位已被其他用户选择'
            })
        end
        -- 已过期，可以继续锁定
    end

    -- 检查是否已售出
    if seatInfo.status == 3 then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位已售出'
        })
    end
end

-- 锁定座位
local newSeatInfo = {
    status = 2,
    userId = userId,
    seatNo = seatNo,
    lockTime = currentTime,
    expireTime = expireTime
}

redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))

-- 更新用户已选座位缓存
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)
local seatsList = {}

if userSeats then
    seatsList = cjson.decode(userSeats)
end

table.insert(seatsList, {row = tonumber(row), col = tonumber(col)})

local ttlSeconds = math.floor((expireTime - currentTime) / 1000)
redis.call('SET', userSeatKey, cjson.encode(seatsList), 'EX', ttlSeconds)

return cjson.encode({
    success = true,
    code = 200,
    seat = {row = tonumber(row), col = tonumber(col), seatNo = seatNo},
    lockTime = currentTime,
    expireTime = expireTime,
    expireSeconds = ttlSeconds
})
```

### 6.4 取消单个座位锁定脚本

**文件**: `lua/seat_unlock_single.lua`

```lua
-- seat_unlock_single.lua
-- 取消单个座位的锁定（用户取消选择某个座位时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]行号, ARGV[3]列号

local statusKey = KEYS[1]
local userId = ARGV[1]
local row = ARGV[2]
local col = ARGV[3]
local seatKey = row .. ':' .. col

-- 检查座位状态
local seatData = redis.call('HGET', statusKey, seatKey)

if not seatData then
    return cjson.encode({
        success = false,
        code = 4001,
        message = '座位不存在'
    })
end

local seatInfo = cjson.decode(seatData)

-- 验证是否是当前用户锁定
if seatInfo.userId ~= userId then
    return cjson.encode({
        success = false,
        code = 4003,
        message = '无权操作此座位'
    })
end

-- 释放座位（恢复空闲状态）
local newInfo = {
    status = 1,
    seatNo = seatInfo.seatNo
}

redis.call('HSET', statusKey, seatKey, cjson.encode(newInfo))

-- 从用户已选座位缓存中移除
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)

if userSeats then
    local seatsList = cjson.decode(userSeats)
    local newList = {}

    for i, seat in ipairs(seatsList) do
        if not (seat.row == tonumber(row) and seat.col == tonumber(col)) then
            table.insert(newList, seat)
        end
    end

    if #newList > 0 then
        redis.call('SET', userSeatKey, cjson.encode(newList), 'KEEPTTL')
    else
        redis.call('DEL', userSeatKey)
    end
end

return cjson.encode({
    success = true,
    code = 200,
    message = '座位已释放'
})
```

### 6.5 验证并批量续期脚本（下单时调用）

**文件**: `lua/seat_validate_and_extend.lua`

```lua
-- seat_validate_and_extend.lua
-- 验证座位有效性并批量续期（创建订单时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]订单号, ARGV[3]新过期时间戳, ARGV[4]座位数量, ARGV[5+]座位列表(row:col格式)

local statusKey = KEYS[1]
local userId = ARGV[1]
local orderNo = ARGV[2]
local newExpireTime = tonumber(ARGV[3])
local seatCount = tonumber(ARGV[4])
local seats = {}

-- 解析座位列表
for i = 5, #ARGV do
    table.insert(seats, ARGV[i])
end

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 第一步：验证所有座位
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

    -- 验证是否是当前用户锁定
    if seatInfo.userId ~= userId then
        return cjson.encode({
            success = false,
            code = 4003,
            message = '座位 ' .. seatKey .. ' 已被其他用户选择',
            failedSeat = seatKey
        })
    end

    -- 验证座位是否仍被锁定
    if seatInfo.status ~= 2 then
        return cjson.encode({
            success = false,
            code = 4004,
            message = '座位 ' .. seatKey .. ' 状态异常',
            failedSeat = seatKey
        })
    end

    -- 验证是否快过期（少于30秒）
    if seatInfo.expireTime - currentTime < 30000 then
        return cjson.encode({
            success = false,
            code = 4005,
            message = '座位 ' .. seatKey .. ' 即将过期，请重新选择',
            failedSeat = seatKey
        })
    end
end

-- 第二步：批量续期所有座位
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)
    local seatInfo = cjson.decode(seatData)

    seatInfo.expireTime = newExpireTime
    redis.call('HSET', statusKey, seatKey, cjson.encode(seatInfo))
end

-- 第三步：创建订单座位关联
local orderSeatKey = 'order:seat:' .. orderNo
local orderSeatData = cjson.encode({
    ticketId = statusKey:match('seat:status:(%d+)'),
    seats = seats,
    userId = userId,
    status = 2,
    extendTime = currentTime,
    expireTime = newExpireTime
})
local newTtlSeconds = math.floor((newExpireTime - currentTime) / 1000)
redis.call('SET', orderSeatKey, orderSeatData, 'EX', newTtlSeconds)

-- 第四步：删除用户选座缓存（已转为订单）
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
redis.call('DEL', userSeatKey)

return cjson.encode({
    success = true,
    code = 200,
    orderNo = orderNo,
    extendedCount = #seats,
    expireTime = newExpireTime,
    expireSeconds = newTtlSeconds
})
```

### 6.6 释放所有座位脚本（换座/取消时调用）

**文件**: `lua/seat_release_all.lua`

```lua
-- seat_release_all.lua
-- 释放用户所有锁定的座位（换座时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID

local statusKey = KEYS[1]
local userId = ARGV[1]

-- 获取用户已选座位
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)

if not userSeats then
    return cjson.encode({
        success = true,
        code = 200,
        message = '没有需要释放的座位',
        releasedCount = 0
    })
end

local seatsList = cjson.decode(userSeats)
local releasedCount = 0

-- 释放所有座位
for i, seat in ipairs(seatsList) do
    local seatKey = seat.row .. ':' .. seat.col
    local seatData = redis.call('HGET', statusKey, seatKey)

    if seatData then
        local seatInfo = cjson.decode(seatData)

        -- 只有当前用户锁定的座位才释放
        if seatInfo.userId == userId and seatInfo.status == 2 then
            local newInfo = {
                status = 1,
                seatNo = seatInfo.seatNo
            }
            redis.call('HSET', statusKey, seatKey, cjson.encode(newInfo))
            releasedCount = releasedCount + 1
        end
    end
end

-- 删除用户选座缓存
redis.call('DEL', userSeatKey)

return cjson.encode({
    success = true,
    code = 200,
    releasedCount = releasedCount,
    releasedSeats = seatsList
})
```

### 6.7 确认座位售出脚本（支付成功时调用）

**文件**: `lua/seat_confirm.lua`

```lua
-- seat_confirm.lua
-- 确认座位售出（支付成功后调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]订单号, ARGV[2]座位数量, ARGV[3+]座位列表(row:col格式)

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
        if seatInfo.status == 2 then
            -- 更新为已售状态
            local newInfo = {
                status = 3,
                userId = seatInfo.userId,
                seatNo = seatInfo.seatNo
            }
            redis.call('HSET', statusKey, seatKey, cjson.encode(newInfo))
            confirmedCount = confirmedCount + 1
        end
    end
end

-- 更新订单座位缓存（延长缓存时间到7天）
local orderSeatKey = 'order:seat:' .. orderNo
local orderSeatData = redis.call('GET', orderSeatKey)
if orderSeatData then
    local data = cjson.decode(orderSeatData)
    data.status = 3
    redis.call('SET', orderSeatKey, cjson.encode(data), 'EX', 604800)
end

return cjson.encode({
    success = true,
    code = 200,
    confirmedCount = confirmedCount
})
```

---

## 六、Node.js 服务层封装

**文件**: `services/ticketPurchaseService.js`（新增，统一服务）

```javascript
/**
 * 票务购买服务（统一使用 Lua 脚本）
 * 支持普通抢票和选座抢票
 */
const fs = require("fs");
const path = require("path");
const RedisService = require("./redisService");

class TicketPurchaseService extends RedisService {
  constructor() {
    super();

    // 加载 Lua 脚本
    this.luaDir = path.join(__dirname, "../lua");
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
      return await client.script("LOAD", script);
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

      const result = await client.evalsha(
        this.scriptSha.ticketPurchase,
        2, // key数量
        stockKey,
        purchaseKey,
        String(userId),
        String(quantity),
        orderNo,
        expireTime,
      );

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

      const result = await client.evalsha(
        this.scriptSha.ticketPurchaseSeat,
        2, // key数量
        statusKey,
        purchaseKey,
        String(userId),
        orderNo,
        expireTime,
        String(seats.length),
        ...seatKeys,
      );

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

      const result = await client.evalsha(
        this.scriptSha.realtimeLock,
        1,
        statusKey,
        String(userId),
        String(row),
        String(col),
        seatNo,
        expireTime,
      );

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

      const result = await client.evalsha(
        this.scriptSha.unlockSingle,
        1,
        statusKey,
        String(userId),
        String(row),
        String(col),
      );

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
  async validateAndExtend({
    ticketId,
    seats,
    userId,
    orderNo,
    newExpireSeconds = 600,
  }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const newExpireTime = Date.now() + newExpireSeconds * 1000;

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    let client = null;
    try {
      client = await this.pool.getClient();

      const result = await client.evalsha(
        this.scriptSha.validateAndExtend,
        1,
        statusKey,
        String(userId),
        orderNo,
        newExpireTime,
        seatKeys.length,
        ...seatKeys,
      );

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

      const result = await client.evalsha(
        this.scriptSha.releaseAll,
        1,
        statusKey,
        String(userId),
      );

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
      const field = `${seat.row}:${seat.col}`;
      seatData[field] = JSON.stringify({
        status: 1,
        seatNo: seat.seatNo || `${seat.row}排${seat.col}座`,
      });
    });

    if (Object.keys(seatData).length > 0) {
      await this.hsetObjFun(key, seatData);
      await this.expire(key, 48 * 60 * 60);
    }

    return { success: true, count: Object.keys(seatData).length };
  }

  /**
   * 获取座位实时状态
   */
  async getSeatStatus(ticketId) {
    const key = this._getSeatStatusKey(ticketId);
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
```

---

## 七、数据库变更

### 7.1 修改 Order 表 seat 字段类型

**文件**: `migrations/20260410000000-update-order-seat-field.js`

```javascript
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 修改 orders 表的 seat 字段为 JSON 类型
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '选座信息，格式: [{row:1, col:2, seatNo:"A1"}]',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
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

    if (!ticketId) {
      return res.json(util.fail("票务ID不能为空"));
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
    let seatStatus = await seatRealtimeService.getSeatStatus(ticketId);

    // 如果 Redis 中没有，初始化座位状态
    if (!seatStatus) {
      const seatLayout = seatConfig.seats || [];
      await seatRealtimeService.initializeSeatStatus(ticketId, seatLayout);
      seatStatus = await seatRealtimeService.getSeatStatus(ticketId);
    }

    // 组装座位图数据
    const layout = (seatConfig.seats || []).map((seat) => {
      const key = `${seat.row}:${seat.col}`;
      const status = seatStatus[key] || { status: 1 };
      const blockedSeats = seatConfig.blockedSeats || [];
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
        maxPurchaseQuantity: ticket.maxPurchaseQuantity,
      }),
    );
  } catch (error) {
    console.error("获取座位图失败:", error);
    return res.json(util.fail("获取失败", error.message));
  }
};
```

### 8.2 实时锁定座位

**接口**: `POST /api/ticket/seats/lock`

```javascript
/**
 * 实时锁定单个座位（用户点击座位时调用）
 */
exports.lockSeat = async (req, res) => {
  try {
    const { ticketId, row, col, seatNo, userId } = req.body;

    if (!ticketId || row === undefined || col === undefined || !userId) {
      return res.json(util.fail("参数不完整"));
    }

    // 获取票务信息
    const ticket = await Ticket.findOne({
      where: { id: ticketId },
      attributes: ["id", "isSeat", "maxPurchaseQuantity"],
    });

    if (!ticket || ticket.isSeat !== 2) {
      return res.json(util.fail("该票务不需要选座"));
    }

    // 检查用户已选座位数量
    const userSeats = await seatRealtimeService.getUserSelectedSeats(
      ticketId,
      userId,
    );
    if (userSeats.seats.length >= ticket.maxPurchaseQuantity) {
      return res.json(util.fail(`最多选择${ticket.maxPurchaseQuantity}个座位`));
    }

    // 使用 Lua 脚本锁定座位（3分钟）
    const lockResult = await seatRealtimeService.lockSeat({
      ticketId,
      row,
      col,
      seatNo,
      userId,
      expireSeconds: 180, // 3分钟
    });

    if (!lockResult.success) {
      return res.json(util.fail(lockResult.message, { code: lockResult.code }));
    }

    return res.json(
      util.success("锁定成功", {
        seat: lockResult.seat,
        expireTime: lockResult.expireTime,
        expireSeconds: lockResult.expireSeconds,
      }),
    );
  } catch (error) {
    console.error("锁定座位失败:", error);
    return res.json(util.fail("锁定失败", error.message));
  }
};
```

### 8.3 取消单个座位锁定

**接口**: `POST /api/ticket/seats/unlock`

```javascript
/**
 * 取消单个座位锁定（用户取消选择某个座位时调用）
 */
exports.unlockSeat = async (req, res) => {
  try {
    const { ticketId, row, col, userId } = req.body;

    if (!ticketId || row === undefined || col === undefined || !userId) {
      return res.json(util.fail("参数不完整"));
    }

    const result = await seatRealtimeService.unlockSeat({
      ticketId,
      row,
      col,
      userId,
    });

    if (!result.success) {
      return res.json(util.fail(result.message, { code: result.code }));
    }

    return res.json(util.success("取消成功"));
  } catch (error) {
    console.error("取消座位失败:", error);
    return res.json(util.fail("取消失败", error.message));
  }
};
```

### 8.4 释放所有座位（换座）

**接口**: `POST /api/ticket/seats/release-all`

```javascript
/**
 * 释放用户所有锁定的座位（换座时调用）
 */
exports.releaseAllSeats = async (req, res) => {
  try {
    const { ticketId, userId } = req.body;

    if (!ticketId || !userId) {
      return res.json(util.fail("参数不完整"));
    }

    const result = await seatRealtimeService.releaseAllSeats({
      ticketId,
      userId,
    });

    return res.json(
      util.success("释放成功", {
        releasedCount: result.releasedCount,
        releasedSeats: result.releasedSeats,
      }),
    );
  } catch (error) {
    console.error("释放所有座位失败:", error);
    return res.json(util.fail("释放失败", error.message));
  }
};
```

---

## 九、修改抢票流程支持选座

### 9.1 修改 createOrder 方法

**文件**: `routes/managementSystem/payment/seckillPayment.js`

```javascript
const seatRealtimeService = require("../../../services/seatRealtimeService");

/**
 * 高并发抢票 - 创建订单（支持选座）
 */
exports.createOrder = async (req, res) => {
  const startTime = Date.now();
  const { goodsId, userId, count, seats } = req.body;

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
      // 需要选座
      if (!seats || !Array.isArray(seats) || seats.length === 0) {
        return res.json(util.fail("请选择座位"));
      }

      if (seats.length !== count) {
        return res.json(util.fail("选择座位数量与购买数量不匹配"));
      }

      // 生成正式订单号
      formalOrderNo = await util.generateOrderNo("ORD");

      // 【关键】验证座位有效性并批量续期到10分钟
      const extendResult = await seatRealtimeService.validateAndExtend({
        ticketId: goodsId,
        seats,
        userId,
        orderNo: formalOrderNo,
        newExpireSeconds: 600, // 10分钟
      });

      if (!extendResult.success) {
        return res.json(util.fail(extendResult.message));
      }

      selectedSeats = seats;
    }

    // 用户检查、会员等级检查、时间检查...（原有逻辑）
    // ...

    // 扣减 Redis 库存
    const stockResult = await redisService.checkAndDecreaseStock(
      goodsId,
      count,
    );
    if (!stockResult.success) {
      // 回滚座位锁定
      if (formalOrderNo) {
        await seatRealtimeService.releaseAllSeats({
          ticketId: goodsId,
          userId,
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
            expireTime: Date.now() + 600 * 1000,
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
      seatInfo: selectedSeats ? { seats: selectedSeats } : null,
    });

    const processTime = Date.now() - startTime;

    res.json(
      util.success("订单创建成功，请尽快支付", {
        orderNo: orderNo,
        processTime: processTime,
        expireTime: Date.now() + 10 * 60 * 1000,
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
    await Order.update({ orderStatus: 2 }, { where: { orderNumber: orderNo } });

    // 如果是选座订单，确认座位
    if (order.seat) {
      const seats =
        typeof order.seat === "string" ? JSON.parse(order.seat) : order.seat;

      await seatRealtimeService.confirmSeats({
        ticketId: order.goodsId,
        seats: seats,
        orderNo: orderNo,
      });

      console.log(`[Payment] 选座订单 ${orderNo} 座位已确认`);
    }
  } catch (error) {
    console.error("[Payment] 处理支付成功失败:", error);
    throw error;
  }
}
```

### 10.2 订单取消（超时）- 解决幽灵座位问题

#### 问题：幽灵座位

```
更新 MySQL 订单状态 = SUCCESS
    ↓
释放 Redis 座位 = FAILED（网络超时）
    ↓
结果：MySQL 已取消，Redis 座位仍被锁定（幽灵座位）
```

#### 解决方案：补偿机制 + 定时任务

```javascript
/**
 * 处理订单取消（带补偿机制）
 */
async function handleOrderCancel(orderNo, cancelReason) {
  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findOne({
      where: { orderNumber: orderNo },
      transaction,
    });

    if (!order || order.orderStatus !== 1) {
      await transaction.rollback();
      return { success: false, message: "订单状态不允许取消" };
    }

    // 1. 更新订单状态
    await Order.update(
      { orderStatus: 3, verifyStatus: 3 },
      { where: { orderNumber: orderNo }, transaction },
    );

    // 2. 恢复库存
    await redisService.incrFun(`ticket:stock:${order.goodsId}`, order.buyNum);

    // 3. 如果是选座订单，记录补偿任务
    if (order.seat) {
      await CompensationTask.create({
        type: "seat_release",
        orderNo: orderNo,
        ticketId: order.goodsId,
        userId: order.memberId,
        seats: order.seat,
        status: "pending",
        retryCount: 0,
        maxRetry: 5,
        expireTime: new Date(Date.now() + 10 * 60 * 1000), // 10分钟后过期
      }, { transaction });
    }

    await transaction.commit();

    // 4. 异步释放座位（立即尝试）
    if (order.seat) {
      await releaseSeatsAsync(orderNo);
    }

    return { success: true };
  } catch (error) {
    await transaction.rollback();
    console.error("[Cancel] 处理订单取消失败:", error);
    throw error;
  }
}

/**
 * 异步释放座位（带重试）
 */
async function releaseSeatsAsync(orderNo) {
  const task = await CompensationTask.findOne({
    where: { orderNo, type: "seat_release" },
  });

  if (!task || task.status === "success") return;

  try {
    const result = await ticketPurchaseService.releaseAllSeats({
      ticketId: task.ticketId,
      userId: task.userId,
    });

    if (result.success) {
      await task.update({ status: "success", completedAt: new Date() });
      console.log(`[Compensation] 座位释放成功，orderNo: ${orderNo}`);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    await task.increment("retryCount");
    console.error(`[Compensation] 座位释放失败，orderNo: ${orderNo}`, error);
    // 定时任务会继续重试
  }
}
```

#### 兜底机制：定时补偿任务

```javascript
// 每 30 秒执行一次补偿任务
cron.schedule("*/30 * * * * *", async () => {
  const pendingTasks = await CompensationTask.findAll({
    where: {
      type: "seat_release",
      status: "pending",
      retryCount: { [Op.lt]: Sequelize.col("maxRetry") },
      createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    limit: 100,
  });

  for (const task of pendingTasks) {
    await releaseSeatsAsync(task.orderNo);
  }
});
```

#### 最终兜底：座位过期自动释放

```lua
-- 即使补偿任务失败，座位也有过期时间
-- 选座锁定：3分钟
-- 订单锁定：10分钟
-- 过期后座位自动变为可选状态
```

**补偿任务表结构：**

```javascript
// models/compensationTaskModel/index.js
module.exports = (sequelize, DataTypes) => {
  const CompensationTask = sequelize.define(
    "CompensationTask",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      type: { type: DataTypes.STRING(50), allowNull: false }, // seat_release
      orderNo: { type: DataTypes.STRING(100), allowNull: false },
      ticketId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      seats: { type: DataTypes.JSON, allowNull: true },
      status: { type: DataTypes.STRING(20), defaultValue: "pending" }, // pending, success, failed
      retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      maxRetry: { type: DataTypes.INTEGER, defaultValue: 5 },
      expireTime: { type: DataTypes.DATE, allowNull: false },
      completedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "compensation_tasks",
      timestamps: true,
    },
  );

  return CompensationTask;
};
```

---

## 十一、前端交互流程

### 11.1 选座流程图

```
用户进入购票页面
    ↓
判断是否需要选座 (isSeat === 2)
    ↓ 是
调用 GET /api/ticket/seats/:ticketId 获取座位图
    ↓
渲染座位图（实时状态）
    ↓
用户点击座位
    ↓
调用 POST /api/ticket/seats/lock 实时锁定（3分钟倒计时）
    ↓
锁定成功，显示倒计时
    ↓
用户可以继续选座（每个座位独立倒计时）
    ↓
用户点击已选座位（取消）
    ↓
调用 POST /api/ticket/seats/unlock 取消单个座位
    ↓
继续选其他座位（灵活操作）
    ↓
用户点击"去支付"
    ↓
调用 POST /api/payment/createOrder
    ↓
系统验证所有座位（剩余时间>30秒）
    ↓
验证通过，所有座位延长到10分钟
    ↓
订单创建成功，进入支付页面
    ↓
支付成功/超时取消
    ↓
确认座位/释放座位
```

### 11.2 前端关键代码

```javascript
// 选座组件核心逻辑
const SeatSelector = {
  data() {
    return {
      selectedSeats: [], // 已选座位 [{row, col, seatNo, expireTime}]
      countdowns: {}, // 每个座位的倒计时
      timers: {}, // 定时器
    };
  },

  methods: {
    // 点击座位
    async onSeatClick(seat) {
      const isSelected = this.selectedSeats.some(
        (s) => s.row === seat.row && s.col === seat.col,
      );

      if (isSelected) {
        // 取消选择
        await this.cancelSeat(seat);
      } else {
        // 添加选择
        await this.selectSeat(seat);
      }
    },

    // 选择座位
    async selectSeat(seat) {
      if (this.selectedSeats.length >= this.maxSelect) {
        this.$message.warning(`最多选择${this.maxSelect}个座位`);
        return;
      }

      try {
        const res = await api.lockSeat({
          ticketId: this.ticketId,
          row: seat.row,
          col: seat.col,
          seatNo: seat.seatNo,
          userId: this.userId,
        });

        if (res.code === 200) {
          this.selectedSeats.push({
            row: seat.row,
            col: seat.col,
            seatNo: seat.seatNo,
            expireTime: res.data.expireTime,
          });
          this.startCountdown(seat.row, seat.col, res.data.expireTime);
        } else {
          this.$message.error(res.message);
          // 刷新座位图
          this.refreshSeatMap();
        }
      } catch (error) {
        console.error("锁定座位失败:", error);
      }
    },

    // 取消座位
    async cancelSeat(seat) {
      try {
        await api.unlockSeat({
          ticketId: this.ticketId,
          row: seat.row,
          col: seat.col,
          userId: this.userId,
        });

        this.selectedSeats = this.selectedSeats.filter(
          (s) => !(s.row === seat.row && s.col === seat.col),
        );
        this.stopCountdown(seat.row, seat.col);
      } catch (error) {
        console.error("取消座位失败:", error);
      }
    },

    // 重新选座（释放所有）
    async reselectAll() {
      this.$confirm("重新选座将释放当前已选座位，是否继续？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(async () => {
        await api.releaseAllSeats({
          ticketId: this.ticketId,
          userId: this.userId,
        });

        this.selectedSeats = [];
        this.stopAllCountdowns();
        this.refreshSeatMap();
      });
    },

    // 创建订单
    async createOrder() {
      // 检查是否有座位快过期
      const now = Date.now();
      const minExpireTime = Math.min(
        ...this.selectedSeats.map((s) => s.expireTime),
      );

      if (minExpireTime - now < 30000) {
        this.$message.warning("有座位即将过期，请重新选择");
        return;
      }

      try {
        const res = await api.createOrder({
          goodsId: this.ticketId,
          userId: this.userId,
          count: this.selectedSeats.length,
          seats: this.selectedSeats.map((s) => ({
            row: s.row,
            col: s.col,
            seatNo: s.seatNo,
          })),
        });

        if (res.code === 200) {
          this.stopAllCountdowns();
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

    // 启动倒计时
    startCountdown(row, col, expireTime) {
      const key = `${row}:${col}`;
      this.stopCountdown(row, col);

      this.timers[key] = setInterval(() => {
        const remaining = expireTime - Date.now();
        this.$set(this.countdowns, key, Math.max(0, remaining));

        if (remaining <= 0) {
          this.stopCountdown(row, col);
          this.$message.warning(`${row}排${col}座已过期`);
          this.selectedSeats = this.selectedSeats.filter(
            (s) => !(s.row === row && s.col === col),
          );
          this.refreshSeatMap();
        }
      }, 1000);
    },

    // 停止倒计时
    stopCountdown(row, col) {
      const key = `${row}:${col}`;
      if (this.timers[key]) {
        clearInterval(this.timers[key]);
        delete this.timers[key];
        delete this.countdowns[key];
      }
    },

    // 停止所有倒计时
    stopAllCountdowns() {
      Object.keys(this.timers).forEach((key) => {
        clearInterval(this.timers[key]);
      });
      this.timers = {};
      this.countdowns = {};
    },
  },
};
```

---

## 十二、错误码定义

| 错误码 | 说明                 | 处理建议     |
| ------ | -------------------- | ------------ |
| 4001   | 座位不存在           | 刷新座位图   |
| 4002   | 座位已售出           | 选择其他座位 |
| 4003   | 座位已被其他用户选择 | 选择其他座位 |
| 4004   | 座位状态异常         | 刷新座位图   |
| 4005   | 座位即将过期         | 重新选择座位 |

---

## 十三、相关文件清单

```
新增文件:
├── lua/
│   ├── ticket_purchase.lua          # 普通抢票（无需选座）
│   ├── ticket_purchase_seat.lua     # 选座抢票（需要选座）
│   ├── seat_realtime_lock.lua       # 实时锁定单个座位
│   ├── seat_unlock_single.lua       # 取消单个座位
│   ├── seat_validate_and_extend.lua # 验证并批量续期
│   ├── seat_release_all.lua         # 释放所有座位
│   └── seat_confirm.lua             # 确认座位售出
├── migrations/
│   ├── 20260410000000-update-order-seat-field.js
│   └── 20260410000001-create-compensation-tasks.js
├── models/compensationTaskModel/index.js  # 补偿任务表模型
├── services/ticketPurchaseService.js
├── tasks/compensationTask.js              # 定时补偿任务
└── docs/seat-selection-development-guide-v2.md

修改文件:
├── models/orderModel/index.js       # 修改seat字段类型
├── routes/managementSystem/payment/seckillPayment.js
└── routes/mobileApp/ticketingRouter/ticketing.js
```

---

## 十四、实施步骤

1. **创建 Lua 脚本文件**（7个脚本）
2. **执行数据库迁移**
   - 修改 order 表 seat 字段为 JSON 类型
   - 创建 compensation_tasks 补偿任务表
3. **部署 ticketPurchaseService.js**
4. **修改抢票接口**统一使用Lua
5. **实现补偿机制**
   - 订单取消时记录补偿任务
   - 部署定时任务（每30秒执行）
6. **前端开发**选座组件
7. **联调测试**
8. **上线部署**

---

**文档完成，请确认方案后开始代码实现。**
````
