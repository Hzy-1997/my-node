# Lua 脚本调用关系文档

> 本文档列出所有 Lua 脚本的调用位置、参数传递和返回值

---

## 一、调用关系总览

```
ticketPurchaseService.js (服务层)
    │
    ├─▶ ticket_purchase.lua         (普通抢票)
    ├─▶ ticket_purchase_seat.lua    (选座抢票)
    ├─▶ seat_realtime_lock.lua      (锁定座位)
    ├─▶ seat_unlock_single.lua      (解锁单个座位)
    ├─▶ seat_validate_and_extend.lua (验证并续期)
    ├─▶ seat_release_all.lua        (释放所有座位)
    └─▶ seat_confirm.lua            (确认售出)
```

---

## 二、脚本详解

### 2.1 ticket_purchase.lua（普通抢票）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `purchaseTicket()`  
**行号**: 第 93-115 行

#### 调用代码
```javascript
async purchaseTicket({ ticketId, userId, quantity, orderNo }) {
    const stockKey = this._getStockKey(ticketId);           // "ticket:stock:{ticketId}"
    const purchaseKey = this._getPurchaseKey(userId, ticketId); // "purchase:{userId}:{ticketId}"
    const expireTime = Date.now() + 86400 * 1000;           // 24小时后过期

    const result = await client.evalSha(this.scriptSha.ticketPurchase, {
        keys: [stockKey, purchaseKey],
        arguments: [
            String(userId),      // ARGV[1]
            String(quantity),    // ARGV[2]
            orderNo,             // ARGV[3]
            String(expireTime)   // ARGV[4]
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `stockKey` | `ticket:stock:123` | 库存 key |
| KEYS[2] | `purchaseKey` | `purchase:456:123` | 购买记录 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |
| ARGV[2] | `quantity` | `"2"` | 购买数量 |
| ARGV[3] | `orderNo` | `"ORD202504110001"` | 订单号 |
| ARGV[4] | `expireTime` | `"1712812525678"` | 过期时间戳（毫秒）|

#### 返回值

**成功**:
```json
{
    "success": true,
    "code": 200,
    "orderNo": "ORD202504110001",
    "newStock": 856,
    "message": "抢购成功"
}
```

**失败**:
```json
{
    "success": false,
    "code": 4001,
    "message": "您已经购买过该票务"
}
```

#### 错误码

| 错误码 | 含义 |
|--------|------|
| 4001 | 重复购买 |
| 4002 | 库存未初始化 |
| 4003 | 库存不足 |

---

### 2.2 ticket_purchase_seat.lua（选座抢票）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `purchaseTicketWithSeat()`  
**行号**: 第 125-153 行

#### 调用代码
```javascript
async purchaseTicketWithSeat({ ticketId, userId, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId);     // "seat:status:{ticketId}"
    const purchaseKey = this._getPurchaseKey(userId, ticketId);
    const expireTime = Date.now() + 600 * 1000;             // 10分钟后过期

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`); // ["1:5", "1:6"]

    const result = await client.evalSha(this.scriptSha.ticketPurchaseSeat, {
        keys: [statusKey, purchaseKey],
        arguments: [
            String(userId),              // ARGV[1]
            orderNo,                     // ARGV[2]
            String(expireTime),          // ARGV[3]
            String(seats.length),        // ARGV[4]
            ...seatKeys                  // ARGV[5], ARGV[6], ...
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| KEYS[2] | `purchaseKey` | `purchase:456:123` | 购买记录 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |
| ARGV[2] | `orderNo` | `"ORD202504110001"` | 订单号 |
| ARGV[3] | `expireTime` | `"1712813125678"` | 过期时间戳 |
| ARGV[4] | `seatCount` | `"2"` | 座位数量 |
| ARGV[5+] | `seats[]` | `"1:5"`, `"1:6"` | 座位列表（格式：行:列）|

#### 返回值

**成功**:
```json
{
    "success": true,
    "code": 200,
    "orderNo": "ORD202504110001",
    "seats": ["1:5", "1:6"],
    "message": "选座抢票成功"
}
```

**失败**:
```json
{
    "success": false,
    "code": 4003,
    "message": "座位 1:5 已被其他用户选择",
    "failedSeat": "1:5"
}
```

#### 错误码

| 错误码 | 含义 |
|--------|------|
| 4001 | 重复购买 |
| 4002 | 座位不存在 |
| 4003 | 座位被其他用户选择 |
| 4004 | 座位状态异常 |
| 4005 | 座位即将过期 |

---

### 2.3 seat_realtime_lock.lua（实时锁定座位）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `lockSeat()`  
**行号**: 第 163-188 行

#### 调用代码
```javascript
async lockSeat({ ticketId, row, col, seatNo, userId, expireSeconds = 180 }) {
    const statusKey = this._getSeatStatusKey(ticketId);     // "seat:status:{ticketId}"
    const expireTime = Date.now() + expireSeconds * 1000;   // 默认3分钟后过期

    const result = await client.evalSha(this.scriptSha.realtimeLock, {
        keys: [statusKey],
        arguments: [
            String(userId),      // ARGV[1]
            String(row),         // ARGV[2]
            String(col),         // ARGV[3]
            seatNo,              // ARGV[4] - 座位名称，如 "1排5座"
            String(expireTime)   // ARGV[5]
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |
| ARGV[2] | `row` | `"1"` | 行号 |
| ARGV[3] | `col` | `"5"` | 列号 |
| ARGV[4] | `seatNo` | `"1排5座"` | 座位名称 |
| ARGV[5] | `expireTime` | `"1712812525678"` | 过期时间戳 |

#### 返回值

**成功**:
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

**失败**:
```json
{
    "success": false,
    "code": 4003,
    "message": "座位已被其他用户选择"
}
```

---

### 2.4 seat_unlock_single.lua（解锁单个座位）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `unlockSeat()`  
**行号**: 第 193-210 行

#### 调用代码
```javascript
async unlockSeat({ ticketId, row, col, userId }) {
    const statusKey = this._getSeatStatusKey(ticketId);

    const result = await client.evalSha(this.scriptSha.unlockSingle, {
        keys: [statusKey],
        arguments: [
            String(userId),      // ARGV[1]
            String(row),         // ARGV[2]
            String(col)          // ARGV[3]
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |
| ARGV[2] | `row` | `"1"` | 行号 |
| ARGV[3] | `col` | `"5"` | 列号 |

#### 返回值

**成功**:
```json
{
    "success": true,
    "code": 200,
    "seat": {"row": 1, "col": 5},
    "message": "座位已释放"
}
```

---

### 2.5 seat_validate_and_extend.lua（验证并续期）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `validateAndExtend()`  
**行号**: 第 215-238 行

#### 调用代码
```javascript
async validateAndExtend({ ticketId, seats, userId, orderNo, newExpireSeconds = 600 }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const newExpireTime = Date.now() + newExpireSeconds * 1000;

    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    const result = await client.evalSha(this.scriptSha.validateAndExtend, {
        keys: [statusKey],
        arguments: [
            String(userId),          // ARGV[1]
            orderNo,                 // ARGV[2]
            String(newExpireTime),   // ARGV[3]
            String(seatKeys.length), // ARGV[4]
            ...seatKeys              // ARGV[5+]
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |
| ARGV[2] | `orderNo` | `"ORD202504110001"` | 订单号 |
| ARGV[3] | `newExpireTime` | `"1712813125678"` | 新的过期时间 |
| ARGV[4] | `seatCount` | `"2"` | 座位数量 |
| ARGV[5+] | `seats[]` | `"1:5"`, `"1:6"` | 座位列表 |

---

### 2.6 seat_release_all.lua（释放所有座位）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `releaseAllSeats()`  
**行号**: 第 243-261 行

#### 调用代码
```javascript
async releaseAllSeats({ ticketId, userId }) {
    const statusKey = this._getSeatStatusKey(ticketId);

    const result = await client.evalSha(this.scriptSha.releaseAll, {
        keys: [statusKey],
        arguments: [String(userId)],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| ARGV[1] | `userId` | `"456"` | 用户ID |

#### 返回值

**成功**:
```json
{
    "success": true,
    "code": 200,
    "releasedSeats": ["1:5", "1:6"],
    "message": "已释放所有座位"
}
```

---

### 2.7 seat_confirm.lua（确认售出）

#### 调用位置
**文件**: `services/ticketPurchaseService.js`  
**方法**: `confirmSeats()`  
**行号**: 第 266-286 行

#### 调用代码
```javascript
async confirmSeats({ ticketId, seats, orderNo }) {
    const statusKey = this._getSeatStatusKey(ticketId);
    const seatKeys = seats.map((s) => `${s.row}:${s.col}`);

    const result = await client.evalSha(this.scriptSha.confirm, {
        keys: [statusKey],
        arguments: [
            orderNo,                 // ARGV[1]
            String(seatKeys.length), // ARGV[2]
            ...seatKeys              // ARGV[3+]
        ],
    });

    return JSON.parse(result);
}
```

#### 参数传递

| 参数 | Lua 变量 | 示例值 | 说明 |
|------|----------|--------|------|
| KEYS[1] | `statusKey` | `seat:status:123` | 座位状态 key |
| ARGV[1] | `orderNo` | `"ORD202504110001"` | 订单号 |
| ARGV[2] | `seatCount` | `"2"` | 座位数量 |
| ARGV[3+] | `seats[]` | `"1:5"`, `"1:6"` | 座位列表 |

#### 返回值

**成功**:
```json
{
    "success": true,
    "code": 200,
    "seats": ["1:5", "1:6"],
    "message": "座位已确认售出"
}
```

---

## 三、调用流程图

### 普通抢票流程
```
用户点击抢票
    │
    ▼
purchaseTicket()
    │
    ├─▶ KEYS[1]: ticket:stock:123
    ├─▶ KEYS[2]: purchase:456:123
    ├─▶ ARGV[1]: "456" (userId)
    ├─▶ ARGV[2]: "2" (quantity)
    ├─▶ ARGV[3]: "ORD001" (orderNo)
    └─▶ ARGV[4]: "1712812525678" (expireTime)
            │
            ▼
    ticket_purchase.lua
            │
            ├─▶ 检查是否已购买
            ├─▶ 检查库存
            ├─▶ 扣减库存
            └─▶ 记录购买
                    │
                    ▼
            返回 JSON 结果
```

### 选座抢票流程
```
用户选择座位 → 点击锁定 → 提交订单
    │              │           │
    │              │           ▼
    │              │   purchaseTicketWithSeat()
    │              │           │
    │              │           ▼
    │              │   ticket_purchase_seat.lua
    │              │
    │              ▼
    │      lockSeat()
    │              │
    │              ▼
    │      seat_realtime_lock.lua
    │
    ▼
initializeSeatStatus() (管理员初始化)
```

---

## 四、Redis Key 命名规范

| Key 类型 | 格式 | 示例 |
|----------|------|------|
| 库存 | `ticket:stock:{ticketId}` | `ticket:stock:123` |
| 购买记录 | `purchase:{userId}:{ticketId}` | `purchase:456:123` |
| 座位状态 | `seat:status:{ticketId}` | `seat:status:123` |
| 用户座位缓存 | `user:seat:{userId}:{statusKey}` | `user:seat:456:seat:status:123` |
| 订单座位 | `order:seat:{orderNo}` | `order:seat:ORD001` |

---

## 五、座位状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 1 | 空闲 | 可选 |
| 2 | 已锁定 | 被用户选中但未支付 |
| 3 | 已售出 | 已支付完成 |
| 4 | 不可用 | 被系统屏蔽 |
