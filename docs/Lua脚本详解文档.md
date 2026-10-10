# Redis Lua 脚本详解文档

> 本文档详细解释秒杀系统中使用的 Lua 脚本的工作原理、参数传递和返回值

---

## 一、什么是 Lua 脚本？为什么用它？

### 1.1 什么是 Lua 脚本

Lua 是一种轻量级的脚本语言，Redis 支持在服务器端执行 Lua 脚本。

### 1.2 为什么要用 Lua 脚本

| 问题         | 不用 Lua 脚本                         | 使用 Lua 脚本                |
| ------------ | ------------------------------------- | ---------------------------- |
| **原子性**   | 多条 Redis 命令之间可能被其他请求打断 | 整个脚本作为一个原子操作执行 |
| **网络往返** | 需要多次网络请求                      | 一次请求完成所有操作         |
| **竞态条件** | 高并发下可能出现超卖                  | 避免竞态条件                 |

### 1.3 执行流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Node.js   │────▶│    Redis    │────▶│   Lua脚本   │
│   调用方    │     │   服务器    │     │   原子执行  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │◀──────────── 返回结果 ─────────────────┘
```

---

## 二、Lua 脚本基础语法

### 2.1 参数传递

```lua
-- KEYS 数组：Redis 键名（用于集群路由）
local key1 = KEYS[1]  -- 第一个键
local key2 = KEYS[2]  -- 第二个键

-- ARGV 数组：普通参数
local arg1 = ARGV[1]  -- 第一个参数
local arg2 = ARGV[2]  -- 第二个参数
```

### 2.2 Redis 命令调用

```lua
-- 获取值
local value = redis.call('GET', 'mykey')

-- 设置值
redis.call('SET', 'mykey', 'myvalue')

-- Hash 操作
redis.call('HGET', 'hashkey', 'field')
redis.call('HSET', 'hashkey', 'field', 'value')

-- 获取服务器时间
local now = redis.call('TIME')  -- 返回 [秒, 微秒]
```

### 2.3 返回值

```lua
-- 返回字符串
return "success"

-- 返回 JSON（需要 cjson 库）
return cjson.encode({
    success = true,
    code = 200,
    message = "操作成功"
})
```

---

## 三、脚本详解

### 3.1 ticket_purchase.lua（普通抢票）

#### 功能说明

处理普通抢票逻辑（不需要选座），包含：

- 防重复购买检查
- 库存检查
- 扣减库存
- 记录购买信息

#### 参数说明

| 参数    | 类型   | 说明                                         |
| ------- | ------ | -------------------------------------------- |
| KEYS[1] | string | 库存 key，如 `ticket:stock:123`              |
| KEYS[2] | string | 购买记录 key，如 `purchase:456:123:ORDER001` |
| ARGV[1] | string | 用户ID                                       |
| ARGV[2] | string | 购买数量                                     |
| ARGV[3] | string | 订单号                                       |
| ARGV[4] | string | 过期时间戳（毫秒）                           |

#### 代码逐行解释

```lua
-- 1. 定义变量，从参数中获取
local stockKey = KEYS[1]           -- 库存key
local purchaseKey = KEYS[2]        -- 购买记录key
local userId = ARGV[1]             -- 用户ID
local quantity = tonumber(ARGV[2]) -- 购买数量（转数字）
local orderNo = ARGV[3]            -- 订单号
local expireTime = tonumber(ARGV[4]) -- 过期时间

-- 2. 获取当前服务器时间
local now = redis.call('TIME')     -- 返回 [秒, 微秒]
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000
--    秒 * 1000 + 微秒 / 1000 = 毫秒时间戳

-- 3. 检查是否已购买（防重复）
local hasPurchased = redis.call('GET', purchaseKey)
if hasPurchased then
    -- 已购买，返回错误
    return cjson.encode({
        success = false,
        code = 4001,
        message = '您已经购买过该票务'
    })
end

-- 4. 检查库存
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

-- 5. 扣减库存
local newStock = redis.call('DECRBY', stockKey, quantity)
-- DECRBY 是原子操作，返回扣减后的新库存

-- 6. 记录用户购买信息
local purchaseInfo = {
    userId = userId,
    orderNo = orderNo,
    count = quantity,
    time = currentTime
}
redis.call('SET', purchaseKey, cjson.encode(purchaseInfo), 'EX', 86400)
-- EX 86400 = 24小时后过期

-- 7. 返回成功结果
return cjson.encode({
    success = true,
    code = 200,
    orderNo = orderNo,
    newStock = tonumber(newStock),
    message = '抢购成功'
})
```

#### 返回值说明

**成功时返回：**

```json
{
  "success": true,
  "code": 200,
  "orderNo": "ORD202504110001",
  "newStock": 856,
  "message": "抢购成功"
}
```

**失败时返回（示例）：**

```json
{
  "success": false,
  "code": 4003,
  "message": "库存不足"
}
```

#### 错误码说明

| 错误码 | 含义         | 场景                         |
| ------ | ------------ | ---------------------------- |
| 4001   | 重复购买     | 用户已经购买过该票务         |
| 4002   | 库存未初始化 | Redis 中没有该商品的库存数据 |
| 4003   | 库存不足     | 剩余库存小于购买数量         |

---

### 3.2 seat_realtime_lock.lua（实时锁定座位）

#### 功能说明

用户点击座位时锁定该座位，防止被其他人选走。

#### 参数说明

| 参数    | 类型   | 说明                               |
| ------- | ------ | ---------------------------------- |
| KEYS[1] | string | 座位状态 key，如 `seat:status:123` |
| ARGV[1] | string | 用户ID                             |
| ARGV[2] | string | 行号                               |
| ARGV[3] | string | 列号                               |
| ARGV[4] | string | 座位名称，如 "1排5座"              |
| ARGV[5] | string | 过期时间戳（毫秒）                 |

#### 代码逐行解释

```lua
-- 1. 获取参数
local statusKey = KEYS[1]          -- 座位状态hash的key
local userId = ARGV[1]             -- 用户ID
local row = ARGV[2]                -- 行号
local col = ARGV[3]                -- 列号
local seatNo = ARGV[4]             -- 座位名称
local expireTime = tonumber(ARGV[5]) -- 过期时间
local seatKey = row .. ':' .. col  -- 组合成 "1:5" 这样的key

-- 2. 获取当前时间
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 3. 检查座位当前状态
local seatData = redis.call('HGET', statusKey, seatKey)
-- HGET hash名 field名

-- 4. 如果座位已存在数据，检查状态
if seatData then
    local seatInfo = cjson.decode(seatData)

    -- 4.1 检查是否已被其他用户锁定（status == 2）
    if seatInfo.status == 2 then
        -- 检查锁定是否已过期
        if seatInfo.expireTime and seatInfo.expireTime > currentTime then
            return cjson.encode({
                success = false,
                code = 4003,
                message = '座位已被其他用户选择'
            })
        end
        -- 已过期，可以继续锁定（抢占）
    end

    -- 4.2 检查是否已售出（status == 3）
    if seatInfo.status == 3 then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位已售出'
        })
    end
end

-- 5. 锁定座位（创建新的座位信息）
local newSeatInfo = {
    status = 2,              -- 2 = 已锁定
    userId = userId,
    seatNo = seatNo,
    lockTime = currentTime,
    expireTime = expireTime
}

-- 5.1 保存到 Redis Hash
redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))

-- 6. 更新用户的已选座位列表（用于显示和验证）
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)
local seatsList = {}

if userSeats then
    seatsList = cjson.decode(userSeats)
end

-- 检查是否已存在这个座位
local exists = false
for i, seat in ipairs(seatsList) do
    if seat.row == tonumber(row) and seat.col == tonumber(col) then
        exists = true
        break
    end
end

-- 不存在则添加
if not exists then
    table.insert(seatsList, {row = tonumber(row), col = tonumber(col)})
end

-- 6.1 保存用户座位列表，设置过期时间
local ttlSeconds = math.floor((expireTime - currentTime) / 1000)
redis.call('SET', userSeatKey, cjson.encode(seatsList), 'EX', ttlSeconds)

-- 7. 返回成功
return cjson.encode({
    success = true,
    code = 200,
    seat = {row = tonumber(row), col = tonumber(col), seatNo = seatNo},
    lockTime = currentTime,
    expireTime = expireTime,
    expireSeconds = ttlSeconds
})
```

#### 座位状态说明

| status | 含义   | 说明               |
| ------ | ------ | ------------------ |
| 1      | 空闲   | 可选               |
| 2      | 已锁定 | 被用户选中但未支付 |
| 3      | 已售出 | 已支付完成         |
| 4      | 不可用 | 被系统屏蔽         |

#### 返回值说明

**成功时返回：**

```json
{
  "success": true,
  "code": 200,
  "seat": {
    "row": 1,
    "col": 5,
    "seatNo": "1排5座"
  },
  "lockTime": 1712812345678,
  "expireTime": 1712812525678,
  "expireSeconds": 180
}
```

---

### 3.3 ticket_purchase_seat.lua（选座抢票）

#### 功能说明

用户提交订单时验证并确认选座，包含：

1. 验证座位是否被当前用户锁定
2. 验证座位是否快过期
3. 将座位状态更新为订单锁定（延长过期时间）

#### 参数说明

| 参数     | 类型   | 说明                        |
| -------- | ------ | --------------------------- |
| KEYS[1]  | string | 座位状态 key                |
| KEYS[2]  | string | 购买记录 key                |
| ARGV[1]  | string | 用户ID                      |
| ARGV[2]  | string | 订单号                      |
| ARGV[3]  | string | 过期时间戳                  |
| ARGV[4]  | string | 座位数量                    |
| ARGV[5+] | string | 座位列表（格式："row:col"） |

#### 执行流程

```
┌─────────────────────────────────────────┐
│  1. 检查是否已购买（防重复）             │
│     └─ 已购买 → 返回错误 4001           │
├─────────────────────────────────────────┤
│  2. 遍历每个座位检查：                   │
│     ├─ 座位是否存在？                   │
│     ├─ 是否被当前用户锁定？             │
│     ├─ 状态是否正常？                   │
│     └─ 是否快过期（<30秒）？            │
├─────────────────────────────────────────┤
│  3. 所有座位检查通过：                   │
│     ├─ 更新座位状态（延长过期时间）      │
│     ├─ 创建订单座位关联                  │
│     └─ 返回成功                          │
└─────────────────────────────────────────┘
```

---

## 四、Node.js 如何调用 Lua 脚本

### 4.1 调用流程

```javascript
// 1. 加载 Lua 脚本文件
const fs = require("fs");
const script = fs.readFileSync("ticket_purchase.lua", "utf8");

// 2. 加载脚本到 Redis（获取 SHA）
const sha = await client.scriptLoad(script);

// 3. 使用 SHA 执行脚本（更快）
const result = await client.evalSha(sha, {
  keys: ["ticket:stock:123", "purchase:456:123:ORDER001"],
  arguments: ["456", "2", "ORDER001", "1712812525678"],
});

// 4. 解析返回结果
const data = JSON.parse(result);
```

### 4.2 完整调用示例

```javascript
// services/ticketPurchaseService.js

async purchaseTicket({ ticketId, userId, quantity, orderNo }) {
    const stockKey = `ticket:stock:${ticketId}`;
    const purchaseKey = `purchase:${userId}:${ticketId}:${orderNo}`;
    const expireTime = Date.now() + 86400 * 1000; // 24小时后过期

    const client = await this.pool.getClient();
    try {
        // 调用 Lua 脚本
        const result = await client.evalSha(this.scriptSha.ticketPurchase, {
            keys: [stockKey, purchaseKey],
            arguments: [
                String(userId),
                String(quantity),
                orderNo,
                String(expireTime)
            ]
        });

        // 解析返回的 JSON
        return JSON.parse(result);
    } finally {
        await this.pool.releaseClient(client);
    }
}
```

---

## 五、常见问题

### Q1: 为什么用 cjson？

Lua 脚本需要返回结构化数据给 Node.js，cjson 库可以将 Lua 表转换为 JSON 字符串。

**注意**：Redis 默认不带 cjson 库，需要额外安装或使用替代方案。

### Q2: KEYS 和 ARGV 有什么区别？

- **KEYS**: Redis 键名，用于集群路由（必须放在前面）
- **ARGV**: 普通参数，可以是任意值

### Q3: 脚本执行失败会回滚吗？

Lua 脚本在 Redis 中是**原子执行**的，要么全部成功，要么全部不执行。但如果脚本内部逻辑有多个 Redis 操作，前面的操作成功后后面的失败，**不会自动回滚**。

这就是为什么要在脚本开头做所有检查，确保条件满足后再执行修改操作。

### Q4: 错误码是返回给前端的吗？

**不是直接返回给前端**。流程是：

```
Lua脚本 ──▶ Node.js ──▶ 前端
   │           │
   │           └─ 根据 code 判断，包装成统一的 API 响应
   └─ 返回 {success, code, message}
```

Node.js 会根据 Lua 返回的 `code` 决定如何响应前端。

---

## 六、总结

| 脚本                         | 功能         | 核心操作                           |
| ---------------------------- | ------------ | ---------------------------------- |
| ticket_purchase.lua          | 普通抢票     | 检查库存 → 扣减 → 记录购买         |
| ticket_purchase_seat.lua     | 选座抢票     | 验证座位 → 更新状态 → 创建订单关联 |
| seat_realtime_lock.lua       | 锁定座位     | 检查状态 → 锁定 → 更新用户列表     |
| seat_unlock_single.lua       | 解锁座位     | 验证用户 → 释放座位                |
| seat_validate_and_extend.lua | 验证并续期   | 验证锁定 → 延长过期时间            |
| seat_release_all.lua         | 释放所有座位 | 清除用户所有锁定                   |
| seat_confirm.lua             | 确认售出     | 更新座位为已售出状态               |
