# Redis 与 Lua 脚本使用位置梳理

> 本文档梳理项目里 Redis、Lua 脚本的所有真实使用位置（含行号），以及它们之间的调用链路。
> 结论先行：**Redis 和 Lua 确实在用，但主要集中在「票务抢票」「套餐购买」「登录验证码」「移动端缓存」四块。酒店预定服务 `hotelPurchaseService` 写好了却没接入任何路由，所以你在 `hotelRouter/hotel.js` 里找不到。**

---

## 一、基础设施层（Redis 连接 + 连接池）

| 文件 | 作用 |
|------|------|
| [redisConfig.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/config/redisConfig.js) | Redis 连接配置（host/port/password/连接池/锁参数） |
| [redisPool.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/redisPool.js) | 自定义 Redis 连接池（getClient / releaseClient） |
| [redisService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/redisService.js) | Redis 服务单例，封装 get/set/hash/list/分布式锁/库存扣减 |

- [redisService.js#L839](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/redisService.js#L839) 导出全局单例 `redisService`
- [redisService.js#L652-L702](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/redisService.js#L652-L702) 分布式锁 `acquireLock` / `releaseLock`（释放锁本身就用了一段 Lua 保证原子性）
- [redisService.js#L748-L780](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/redisService.js#L748-L780) `checkAndDecreaseStock` 抢票核心（锁 + 检查 + 扣减）

---

## 二、Lua 脚本清单

### 通用库存脚本（套餐 / 酒店共用）
| 脚本 | 作用 |
|------|------|
| [lua/common/stock_deduct.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/common/stock_deduct.lua) | 多 key 原子扣减：先遍历检查所有 key 库存，再统一 DECRBY |
| [lua/common/stock_refund.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/common/stock_refund.lua) | 多 key 原子恢复：遍历 INCRBY |

### 票务专用脚本（选座 / 抢票）
| 脚本 | 作用 |
|------|------|
| [lua/ticket/ticket_purchase.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/ticket_purchase.lua) | 普通抢票：检查库存、扣减、记录购买 |
| [lua/ticket/ticket_purchase_seat.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/ticket_purchase_seat.lua) | 选座抢票：验证座位、批量续期、创建订单关联 |
| [lua/ticket/seat_realtime_lock.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/seat_realtime_lock.lua) | 实时锁座 |
| [lua/ticket/seat_unlock_single.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/seat_unlock_single.lua) | 取消单个座位 |
| [lua/ticket/seat_validate_and_extend.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/seat_validate_and_extend.lua) | 验证并批量续期 |
| [lua/ticket/seat_release_all.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/seat_release_all.lua) | 释放所有座位 |
| [lua/ticket/seat_confirm.lua](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/lua/ticket/seat_confirm.lua) | 确认座位售出 |

---

## 三、服务层（加载并执行 Lua 脚本）

### 1. BasePurchaseService（基类，套餐/酒店共用）
[basePurchaseService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/basePurchaseService.js)
- [L11](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/basePurchaseService.js#L11) 引入 `RedisService`
- [L17-L27](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/basePurchaseService.js#L17-L27) 读取 `lua/common/` 下两个脚本，启动时 `scriptLoad` 缓存 SHA
- [L67-L85](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/basePurchaseService.js#L67-L85) `deductStock()` → `evalSha(stockDeduct)`
- [L92-L108](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/basePurchaseService.js#L92-L108) `refundStock()` → `evalSha(stockRefund)`

### 2. ComboPurchaseService（套餐购买，已接入路由）
[comboPurchaseService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/comboPurchaseService.js)
- 继承 `BasePurchaseService`
- [L47](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/comboPurchaseService.js#L47) `purchaseCombo()` 内部调 `this.deductStock()`
- 库存 key：`combo:stock:${packageItemId}:${date}` + `hotel:roomtype:stock:${roomTypeId}:${date}`（套餐含酒店时同时扣房型库存）

### 3. HotelPurchaseService（酒店购买，⚠️ 未接入路由）
[hotelPurchaseService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/hotelPurchaseService.js)
- 继承 `BasePurchaseService`
- [L27](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/hotelPurchaseService.js#L27) `purchaseHotel()` → `this.deductStock()`
- [L62](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/hotelPurchaseService.js#L62) `refundHotel()` → `this.refundStock()`
- 库存 key：`hotel:roomtype:stock:${roomTypeId}:${date}`
- **全项目 grep `require.*hotelPurchaseService` 没有任何路由引入它** → 这就是你找不到的原因

### 4. TicketPurchaseService（票务，已接入路由）
[ticketPurchaseService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/ticketPurchaseService.js)
- 继承 `RedisService`
- [L13-L42](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/ticketPurchaseService.js#L13-L42) 加载 `lua/ticket/` 下 7 个脚本
- [L107](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/ticketPurchaseService.js#L107) 抢票 `evalSha(ticketPurchase)`
- [L142](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/ticketPurchaseService.js#L142) 选座抢票 `evalSha(ticketPurchaseSeat)`
- [L174/L198/L225/L249/L274](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/ticketPurchaseService.js#L174) 座位锁/解锁/续期/释放/确认

### 5. QueueService（Bull 队列）
[queueService.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/services/queueService.js#L7-L15) 复用 redisService 的连接配置创建 Bull 队列

---

## 四、路由 / Worker 实际调用点

### 1. 套餐购买路由（套餐 + 酒店库存一起扣）
[comboRouter/combo.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js)
- [L8-L9](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js#L8) 引入 redisService、comboPurchaseService
- [L318](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js#L318) `comboPurchaseService.purchaseCombo()` 扣减库存（走 Lua）
- [L417/L434](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js#L417) `redisService.getFun()` 查套餐/酒店库存
- [L426/L449](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js#L426) 初始化库存到 Redis
- [L471](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/comboRouter/combo.js#L471) `comboPurchaseService.refundStock()` 恢复库存

### 2. 秒杀支付路由（票务抢票 + 选座 + 退款恢复）
[payment/seckillPayment.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js)
- [L18-L23](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L18) 引入 redisService、ticketPurchaseService
- [L55/L62](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L55) 用户信息缓存
- [L102-L106](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L102) `redisService.keys()` 查购买记录
- [L125/L146/L637/L659/L690](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L125) 库存查询/初始化
- [L160](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L160) `purchaseTicketWithSeat()` 选座抢票（Lua）
- [L174](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L174) `purchaseTicket()` 普通抢票（Lua）
- [L354/L385/L414](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L354) 选座锁/解锁/释放（Lua）
- [L970/L1057](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L970) `redisService.incrFun()` 退款恢复票务库存
- [L1000-L1009](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/payment/seckillPayment.js#L1000) 套餐退款 `comboPurchaseService.refundStock()`（Lua）

### 3. 票务路由（抢票核心）
[ticketRoutes.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/ticketRoutes.js)
- [L13](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/ticketRoutes.js#L13) 引入 redisService
- [L35](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/ticketRoutes.js#L35) `initializeTicketStock()` 初始化库存
- [L97](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/ticketRoutes.js#L97) `checkAndDecreaseStock()` 抢票扣减
- [L161-L184](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/ticketRoutes.js#L161) 分布式锁 + 退款恢复

### 4. 登录验证码（Redis 存储）
- [loginRouter/login.js#L20](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/loginRouter/login.js#L20) 引入；[L53](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/loginRouter/login.js#L53) `getFun('code_xxx')` 取验证码
- [loginRouter/verify.js#L12](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/loginRouter/verify.js#L12) 引入；[L40](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/managementSystem/loginRouter/verify.js#L40) `setFun('code_xxx', text, 60)` 存验证码 60s

### 5. 移动端酒店列表缓存（纯缓存，不扣库存）
[mobileApp/hotelRouter/hotel.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/hotelRouter/hotel.js)
- [L6](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/hotelRouter/hotel.js#L6) 引入 redisService
- [L14/L63](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/hotelRouter/hotel.js#L14) 酒店列表缓存 30 分钟
- [L80/L325](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/hotelRouter/hotel.js#L80) 房型详情缓存 10 分钟

### 6. 订单 Worker（异步退款恢复库存）
[workers/orderWorker.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/workers/orderWorker.js)
- [L9-L10](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/workers/orderWorker.js#L9) 引入 redisService、comboPurchaseService
- [L51/L390/L472](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/workers/orderWorker.js#L51) `incrFun()` 恢复票务库存
- [L194/L379/L460](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/workers/orderWorker.js#L194) `comboPurchaseService.refundStock()` 恢复套餐库存（Lua）
- [L330/L372](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/workers/orderWorker.js#L330) `getFun()` 取订单/取消数据

### 7. 补偿任务（座位释放）
[tasks/compensationTask.js](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/tasks/compensationTask.js)
- [L8](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/tasks/compensationTask.js#L8) 引入 ticketPurchaseService
- [L61](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/tasks/compensationTask.js#L61) `releaseAllSeats()`（Lua）

### 8. 已引入但用法被注释（未生效）
- [mobileApp/appLoginRouter/login.js#L19](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/appLoginRouter/login.js#L19) 引入，L260/L286 调用被注释
- [mobileApp/scenicManagementRouter/strategy.js#L22](file:///c:/Users/Administrator/Desktop/node-mysql%20-%20副本%20(2)/mynode/node-full-stack/routes/mobileApp/scenicManagementRouter/strategy.js#L22) 引入，L36/L53 调用被注释

---

## 五、调用链路图

```
套餐购买：
  comboRouter/combo.js
    └─ comboPurchaseService.purchaseCombo()
         └─ basePurchaseService.deductStock()
              └─ evalSha(stock_deduct.lua)   ← 多key原子扣减

票务抢票：
  seckillPayment.js / ticketRoutes.js
    ├─ ticketPurchaseService.purchaseTicket()        ── ticket_purchase.lua
    ├─ ticketPurchaseService.purchaseTicketWithSeat()── ticket_purchase_seat.lua
    ├─ ticketPurchaseService.lockSeat()              ── seat_realtime_lock.lua
    ├─ ticketPurchaseService.unlockSeat()            ── seat_unlock_single.lua
    ├─ ticketPurchaseService.releaseAllSeats()       ── seat_release_all.lua
    └─ ticketPurchaseService.confirmSeat()           ── seat_confirm.lua

退款恢复（统一走 Lua stock_refund 或 incrFun）：
  orderWorker.js / seckillPayment.js / combo.js
    ├─ comboPurchaseService.refundStock()  ── stock_refund.lua
    └─ redisService.incrFun(ticket:stock)  ── 票务直接 INCR

登录验证码 / 列表缓存（纯 Redis，无 Lua）：
  loginRouter / verify.js / mobileApp/hotelRouter
    └─ redisService.setFun / getFun
```

---

## 六、关于酒店预定的结论

| 服务 | 状态 | 说明 |
|------|------|------|
| `hotelPurchaseService` | ⚠️ 已写未接 | `purchaseHotel`/`refundHotel` 已实现，但**无任何路由 require** |
| `hotelRouter/hotel.js` 的 `hotelRoomBook` | ❌ 未用 Redis/Lua | 只查了 `RoomDatePrice`，没扣库存、没落单 |
| 酒店库存的 Redis key | ✅ 被套餐间接管理 | `comboPurchaseService` 在套餐含酒店时会扣 `hotel:roomtype:stock:${roomTypeId}:${date}` |

**所以「酒店预定用 Redis + Lua」目前是：基础设施齐备、服务层写好、但路由层没接。** 要让 `hotelRoomBook` 真正走 Redis+Lua，只需在该方法里 `require('../../../services/hotelPurchaseService')` 并调用 `purchaseHotel()`，参照 `combo.js#L318` 的写法即可。






# Redis 与 Lua 使用位置梳理

## 一、Redis 与 Lua 的关系

- **Redis** 是一个内存数据库，数据存在内存中，读写速度快，但数据易丢失，需持久化。
- **Lua** 是一种轻量级的脚本语言，可以嵌入到 Redis 中执行，用于实现一些复杂的逻辑。

## 二、Redis 与 Lua 的使用场景

- **缓存**：将频繁访问的数据存储在 Redis 中，提高访问速度。
- **分布式锁**：利用 Redis 的原子操作实现分布式锁，保证数据的一致性。
- **限流**：利用 Redis 的计数器实现限流，防止系统被恶意攻击。
- **异步任务**：将一些耗时的任务放入 Redis 队列中，异步执行，提高系统的响应速度。
- **Lua 脚本**：利用 Lua 脚本的原子性，实现一些复杂的逻辑，如事务、分布式锁等。

## 三、Redis 与 Lua 的使用方式

- **直接执行 Lua 脚本**：将 Lua 脚本直接发送给 Redis 执行，适用于简单的逻辑。```lua script eval "return redis.call('get', KEYS[1])" 1 mykey```
- **将 Lua 脚本保存到 Redis**：将 Lua 脚本保存到 Redis 中，通过脚本的 SHA1 哈希值来执行。```script load "return redis.call('get', KEYS[1])"```
- **使用 Redis 的 Lua 脚本管理工具**：如 Redisson、Jedis 等，这些工具提供了更高级的 API，方便使用 Lua 脚本。

## 四、Redis 与 Lua 的优缺点

- **优点**：
  - **性能高**：Redis 是内存数据库，读写速度快，Lua 脚本执行效率高。
  - **灵活性高**：Lua 脚本可以嵌入到 Redis 中执行，实现复杂的逻辑。
  - **原子性**：Lua 脚本在 Redis 中执行是原子的，可以保证数据的一致性。
