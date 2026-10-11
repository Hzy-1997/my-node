# 套餐购买接口 Bug 修复报告

> 修复日期：2026-05-29
> 触发场景：用户购买酒店套餐时，接口报错导致订单创建失败、库存回滚失败

---

## 一、问题总览

购买套餐接口 `POST /api/package/buyCombo` 存在 **3 个 Bug**，其中 2 个为致命错误，1 个为潜在隐患：

| 编号 | 严重程度 | 错误信息 | 影响 |
|------|---------|---------|------|
| BUG-1 | 🔴 致命 | `Cannot add or update a child row: a foreign key constraint fails` | 套餐订单永远无法创建成功 |
| BUG-2 | 🔴 致命 | `"arguments[1]" must be of type "string \| Buffer", got undefined` | 库存回滚失败，已扣减的库存永久丢失 |
| BUG-3 | 🟡 隐患 | 超时取消套餐订单时库存无法恢复 | 10分钟超时后库存不归还 |

---

## 二、BUG-1：外键约束失败

### 2.1 错误信息

```
Cannot add or update a child row: a foreign key constraint fails
(`my_nodemysql`.`package_order_details`,
 CONSTRAINT `package_order_details_ibfk_1`
 FOREIGN KEY (`order_number`) REFERENCES `orders` (`orderNumber`)
 ON DELETE CASCADE ON UPDATE CASCADE)
```

### 2.2 根因分析

**数据库外键关系**：

```
orders.orderNumber  ←──(外键约束)──  package_order_details.order_number
   (主表)                                      (子表)
```

`package_order_details` 表的 `order_number` 字段有外键约束，引用 `orders` 表的 `orderNumber`。这意味着**必须先在 `orders` 表中存在对应记录，才能在 `package_order_details` 表中插入数据**。

**代码问题**：

`orderWorker.js` 中的 `processPackageOrder` 函数直接创建 `PackageOrderDetail`，但**没有先在 `orders` 表中创建主订单记录**：

```
执行流程（有问题）：
1. 查询 PackageItem ✅
2. 生成核销码 ✅
3. 创建 PackageOrderDetail ❌ ← 外键约束失败！orders 表中还没有这条 orderNumber
```

对比票务订单的 `processTicketOrder`，它正确地先调用了 `Order.create()`：

```
票务订单执行流程（正确）：
1. 查询 Ticket ✅
2. 创建 Order（主订单） ✅ ← 先创建主记录
3. 缓存到 Redis ✅
```

### 2.3 修复方案

在 `processPackageOrder` 中，创建 `PackageOrderDetail` **之前**先创建 `Order` 主订单记录。

同时需要修改 `Order` 模型，因为套餐订单不需要票务相关字段（如 `ticketType`、`ticketPrice`、`userIdCard`、`playDate`、`seat`），这些字段原来是 `allowNull: false`，套餐订单创建时会因缺少这些字段而报错。新增 `orderType` 字段来区分订单类型。

### 2.4 代码修改对比

#### 文件1：`workers/orderWorker.js` — processPackageOrder 函数

**修改前**：

```javascript
async function processPackageOrder(orderData) {
    const { rollbackStock, roomTypeId, dateRange, ...orderInfo } = orderData;

    console.log(`[OrderWorker] 处理套餐订单: ${orderInfo.orderNumber}, packageItemId=${orderInfo.packageItemId}`);

    // 获取套餐信息
    const packageItem = await PackageItem.findOne({
        where: { id: orderInfo.packageItemId },
        include: [
            {
                model: RoomPackage,
                as: 'roomPackage'
            }
        ]
    });

    if (!packageItem) {
        throw new Error(`套餐不存在: ${orderInfo.packageItemId}`);
    }

    // ❌ 缺少：没有创建 Order 主订单记录

    // 生成核销码
    const verifyCode = generateVerifyCode();

    // 创建套餐订单详情 ← 外键约束失败！
    const packageOrderDetail = await PackageOrderDetail.create({
        orderNumber: orderInfo.orderNumber,
        // ... 其他字段
    });
    // ...
}
```

**修改后**：

```javascript
async function processPackageOrder(orderData) {
    const { rollbackStock, roomTypeId, dateRange, ...orderInfo } = orderData;

    console.log(`[OrderWorker] 处理套餐订单: ${orderInfo.orderNumber}, packageItemId=${orderInfo.packageItemId}`);

    // 获取套餐信息
    const packageItem = await PackageItem.findOne({
        where: { id: orderInfo.packageItemId },
        include: [
            {
                model: RoomPackage,
                as: 'roomPackage'
            }
        ]
    });

    if (!packageItem) {
        throw new Error(`套餐不存在: ${orderInfo.packageItemId}`);
    }

    // ✅ 新增：先创建主订单记录（满足外键约束：package_order_details.order_number -> orders.orderNumber）
    await Order.create({
        orderNumber: orderInfo.orderNumber,
        orderType: 2,
        memberId: orderInfo.userId,
        userName: orderInfo.userName || '',
        userPhone: orderInfo.userPhone || '',
        buyNum: String(orderInfo.buyNum),
        orderStatus: orderInfo.orderStatus || 1,
        orderAmount: String(orderInfo.totalAmount || 0),
        refundAmount: '0'
    });

    // 生成核销码
    const verifyCode = generateVerifyCode();

    // 创建套餐订单详情 ← 现在不会报外键错误了
    const packageOrderDetail = await PackageOrderDetail.create({
        orderNumber: orderInfo.orderNumber,
        // ... 其他字段
    });
    // ...
}
```

#### 文件2：`models/orderModel/index.js` — Order 模型

**修改前**：

```javascript
const Order = sequelize.define("Order", {
    orderNumber: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: true },
    // ❌ 缺少 orderType 字段
    ticketType: { type: DataTypes.STRING, allowNull: false },  // ❌ 套餐订单不需要
    ticketPrice: { type: DataTypes.STRING, allowNull: false }, // ❌ 套餐订单不需要
    memberId: { type: DataTypes.INTEGER, allowNull: true, /* ... */ },
    goodsId: { type: DataTypes.INTEGER, allowNull: true, /* ... */ },
    userName: { type: DataTypes.STRING, allowNull: false },
    userPhone: { type: DataTypes.STRING, allowNull: false },
    userIdCard: { type: DataTypes.STRING, allowNull: false },  // ❌ 套餐订单不需要
    playDate: { type: DataTypes.STRING, allowNull: false },    // ❌ 套餐订单不需要
    seat: { type: DataTypes.STRING, allowNull: false },        // ❌ 套餐订单不需要
    buyNum: { type: DataTypes.STRING, allowNull: false },
    // ...
});
```

**修改后**：

```javascript
const Order = sequelize.define("Order", {
    orderNumber: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: true },
    // ✅ 新增：订单类型字段
    orderType: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '订单类型：1-票务订单 2-套餐订单'
    },
    ticketType: { type: DataTypes.STRING, allowNull: true },   // ✅ 改为可选
    ticketPrice: { type: DataTypes.STRING, allowNull: true },  // ✅ 改为可选
    memberId: { type: DataTypes.INTEGER, allowNull: true, /* ... */ },
    goodsId: { type: DataTypes.INTEGER, allowNull: true, /* ... */ },
    userName: { type: DataTypes.STRING, allowNull: false },
    userPhone: { type: DataTypes.STRING, allowNull: false },
    userIdCard: { type: DataTypes.STRING, allowNull: true },   // ✅ 改为可选
    playDate: { type: DataTypes.STRING, allowNull: true },     // ✅ 改为可选
    seat: { type: DataTypes.STRING, allowNull: true },         // ✅ 改为可选
    buyNum: { type: DataTypes.STRING, allowNull: false },
    // ...
});
```

#### 文件3：`migrations/20260529000000-add-orderType-and-relax-orders-fields.js` — 数据库迁移

**新增文件**：

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 新增 orderType 字段
        await queryInterface.addColumn('orders', 'orderType', {
            type: Sequelize.INTEGER,
            defaultValue: 1,
            allowNull: true,
            comment: '订单类型：1-票务订单 2-套餐订单'
        });

        // 放宽 NOT NULL 约束
        await queryInterface.changeColumn('orders', 'ticketType', {
            type: Sequelize.STRING, allowNull: true
        });
        await queryInterface.changeColumn('orders', 'ticketPrice', {
            type: Sequelize.STRING, allowNull: true
        });
        await queryInterface.changeColumn('orders', 'userIdCard', {
            type: Sequelize.STRING, allowNull: true
        });
        await queryInterface.changeColumn('orders', 'playDate', {
            type: Sequelize.STRING, allowNull: true
        });
        await queryInterface.changeColumn('orders', 'seat', {
            type: Sequelize.STRING, allowNull: true
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('orders', 'orderType');
        // 回滚字段约束...
    }
};
```

---

## 三、BUG-2：Redis 库存回滚失败

### 3.1 错误信息

```
[BasePurchase] 库存恢复失败: TypeError: "arguments[1]" must be of type "string | Buffer", got undefined instead.
    at encodeCommand (node_modules\@redis\client\dist\lib\RESP\encoder.js:17:19)
    at RedisCommandsQueue.commandsToWrite (node_modules\@redis\client\dist\lib\client\commands-queue.js:364:49)
    ...
```

### 3.2 根因分析

这是一个**异步初始化时序问题**，涉及两层原因：

**原因1：构造函数中异步方法未被 await**

`BasePurchaseService` 的构造函数中调用了 `this._initScripts()`，这是一个异步方法（会连接 Redis 执行 `SCRIPT LOAD`），但构造函数中**无法使用 await**：

```javascript
constructor() {
    super();
    // ... 读取 Lua 脚本文件
    this.scriptSha = {};
    this._initScripts();  // ❌ 异步方法，但没有 await，不会等待完成
}
```

这意味着 `new BasePurchaseService()` 返回时，`this.scriptSha` 还是空对象 `{}`。

**原因2：orderWorker.js 中懒加载导致首次调用时脚本未就绪**

`orderWorker.js` 的 `rollbackPackageStock` 函数中使用了懒加载：

```javascript
async function rollbackPackageStock(orderData) {
    try {
        const comboPurchaseService = require('../services/comboPurchaseService'); // ❌ 首次加载
        // 加载后 _initScripts() 开始异步执行，但还没完成
        // 此时 scriptSha.stockRefund 为 undefined

        await comboPurchaseService.refundStock(stockKeys, buyNum); // ❌ SHA 为 undefined
    }
}
```

**时序图**：

```
时间线：
  │
  ├─ 1. require('comboPurchaseService')  ← 模块加载，构造函数执行
  │     └─ _initScripts() 开始异步执行（连接Redis加载脚本）
  │
  ├─ 2. refundStock() 被调用  ← 此时 _initScripts() 还没执行完！
  │     └─ client.evalSha(undefined, ...)  ← scriptSha.stockRefund 为 undefined
  │        └─ ❌ 报错："arguments[1]" must be of type "string | Buffer", got undefined
  │
  ├─ 3. _initScripts() 执行完毕  ← 太晚了！
  │     └─ [BasePurchase] 脚本加载成功: stockDeduct
  │     └─ [BasePurchase] 脚本加载成功: stockRefund
```

从终端日志也能看出这个时序问题——脚本加载成功的日志出现在回滚开始之后：

```
[1] [OrderWorker] 开始回滚套餐库存: packageItemId=1, roomTypeId=2, buyNum=5
[1] 获取一个可用的客户端连接
[1] 获取一个可用的客户端连接
[1] [BasePurchase] 脚本加载成功: stockDeduct     ← 脚本在这里才加载完
[1] 获取一个可用的客户端连接
[1] [BasePurchase] 脚本加载成功: stockRefund      ← 脚本在这里才加载完
[1] [BasePurchase] 库存恢复失败: TypeError...      ← 但 refundStock 已经先调用了
```

### 3.3 修复方案

采用**按需加载（Lazy Load with Check）**策略：在每次调用 `deductStock` / `refundStock` 前，检查对应脚本的 SHA 是否已加载，若未加载则先加载。

### 3.4 代码修改对比

#### 文件1：`services/basePurchaseService.js` — 新增按需加载方法

**修改前**：

```javascript
class BasePurchaseService extends RedisService {
    constructor() {
        super();
        // ...
        this.scriptSha = {};
        this._initScripts();
    }

    async _initScripts() {
        try {
            for (const [name, script] of Object.entries(this.scripts)) {
                this.scriptSha[name] = await this.scriptLoad(script);
                console.log(`[BasePurchase] 脚本加载成功: ${name}`);
            }
        } catch (error) {
            console.error("[BasePurchase] 脚本加载失败:", error);
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

    // ❌ 没有 _ensureScriptLoaded 方法

    async deductStock(stockKeys, quantity, userId, orderNo) {
        const expireTime = Date.now() + 86400 * 1000;
        let client = null;
        try {
            client = await this.pool.getClient();  // ❌ 直接获取客户端，不检查脚本是否就绪
            const result = await client.evalSha(this.scriptSha.stockDeduct, { /* ... */ });
            // ...
        }
    }

    async refundStock(stockKeys, quantity) {
        let client = null;
        try {
            client = await this.pool.getClient();  // ❌ 直接获取客户端，不检查脚本是否就绪
            const result = await client.evalSha(this.scriptSha.stockRefund, { /* ... */ });
            // ...
        }
    }
}
```

**修改后**：

```javascript
class BasePurchaseService extends RedisService {
    constructor() {
        super();
        // ...
        this.scriptSha = {};
        this._initScripts();
    }

    async _initScripts() {
        try {
            for (const [name, script] of Object.entries(this.scripts)) {
                this.scriptSha[name] = await this.scriptLoad(script);
                console.log(`[BasePurchase] 脚本加载成功: ${name}`);
            }
        } catch (error) {
            console.error("[BasePurchase] 脚本加载失败:", error);
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

    // ✅ 新增：按需加载方法，确保脚本 SHA 已就绪
    async _ensureScriptLoaded(name) {
        if (!this.scriptSha[name]) {
            this.scriptSha[name] = await this.scriptLoad(this.scripts[name]);
            console.log(`[BasePurchase] 脚本按需加载成功: ${name}`);
        }
    }

    async deductStock(stockKeys, quantity, userId, orderNo) {
        const expireTime = Date.now() + 86400 * 1000;
        let client = null;
        try {
            await this._ensureScriptLoaded('stockDeduct');  // ✅ 调用前确保脚本已加载
            client = await this.pool.getClient();
            const result = await client.evalSha(this.scriptSha.stockDeduct, { /* ... */ });
            // ...
        }
    }

    async refundStock(stockKeys, quantity) {
        let client = null;
        try {
            await this._ensureScriptLoaded('stockRefund');  // ✅ 调用前确保脚本已加载
            client = await this.pool.getClient();
            const result = await client.evalSha(this.scriptSha.stockRefund, { /* ... */ });
            // ...
        }
    }
}
```

#### 文件2：`workers/orderWorker.js` — 将懒加载改为顶部加载

**修改前**：

```javascript
const queueService = require('../services/queueService');
const redisService = require('../services/redisService');
// ❌ 没有在顶部加载 comboPurchaseService
const { Order, Ticket, PackageOrderDetail, PackageItem, RoomPackage } = require('../models/Summary');

// ... 省略其他代码

async function rollbackPackageStock(orderData) {
    const { packageItemId, roomTypeId, buyNum, dateRange } = orderData;
    try {
        const comboPurchaseService = require('../services/comboPurchaseService'); // ❌ 懒加载：首次调用时才加载
        for (const date of dateRange) {
            const stockKeys = [
                `combo:stock:${packageItemId}:${date}`,
                `hotel:roomtype:stock:${roomTypeId}:${date}`
            ];
            await comboPurchaseService.refundStock(stockKeys, buyNum); // ❌ 脚本可能还没加载完
        }
    }
}
```

**修改后**：

```javascript
const queueService = require('../services/queueService');
const redisService = require('../services/redisService');
const comboPurchaseService = require('../services/comboPurchaseService'); // ✅ 顶部加载：进程启动时就初始化
const { Order, Ticket, PackageOrderDetail, PackageItem, RoomPackage } = require('../models/Summary');

// ... 省略其他代码

async function rollbackPackageStock(orderData) {
    const { packageItemId, roomTypeId, buyNum, dateRange } = orderData;
    try {
        // ✅ 不再懒加载，直接使用已初始化的 comboPurchaseService
        for (const date of dateRange) {
            const stockKeys = [
                `combo:stock:${packageItemId}:${date}`,
                `hotel:roomtype:stock:${roomTypeId}:${date}`
            ];
            await comboPurchaseService.refundStock(stockKeys, buyNum); // ✅ 配合 _ensureScriptLoaded，脚本一定就绪
        }
    }
}
```

---

## 四、BUG-3：超时取消套餐订单库存无法恢复

### 4.1 问题描述

购买套餐时，`combo.js` 的 `buyCombo` 会创建一个 10 分钟后执行的取消任务：

```javascript
await queueService.addCancelJob({
    orderNo: orderNo,
    packageItemId: combo.id,
    roomTypeId: roomType.id,
    userId: userId,
    count: num,
    dateRange: dateRange,
    reason: '超时未支付'
});
```

但 `orderWorker.js` 的 `processOrderCancel` 只处理了票务订单的库存恢复逻辑，没有套餐订单的分支。

### 4.2 根因分析

`processOrderCancel` 函数解构时只取了票务相关的字段：

```javascript
const { orderNo, goodsId, userId, count, reason } = cancelData;
// ❌ 缺少 packageItemId, roomTypeId, dateRange
```

然后直接使用票务逻辑恢复库存：

```javascript
await redisService.incrFun(`ticket:stock:${goodsId}`, count); // ❌ goodsId 为 undefined
```

套餐订单传入的 `goodsId` 为 `undefined`，导致：
1. Redis key `ticket:stock:undefined` 被错误创建
2. 套餐库存（`combo:stock:*` 和 `hotel:roomtype:stock:*`）无法恢复

### 4.3 代码修改对比

**修改前**：

```javascript
async function processOrderCancel(cancelData) {
    const { orderNo, goodsId, userId, count, reason } = cancelData; // ❌ 缺少套餐字段

    try {
        // ... 查询订单、校验状态

        // ❌ 只有票务恢复逻辑
        await redisService.incrFun(`ticket:stock:${goodsId}`, count);
        const ticket = await Ticket.findOne({ where: { id: goodsId } });
        if (ticket) {
            await ticket.increment('remainingStock', { by: count });
            await ticket.decrement('soldCount', { by: count });
        }
        const orderPurchaseKey = `purchase:${userId}:${goodsId}:${orderNo}`;
        await redisService.delFun(orderPurchaseKey);

        await Order.update({
            orderStatus: 3,
            verifyStatus: 3,
            cancelReason: reason,
            cancelTime: new Date()
        }, { where: { orderNumber: orderNo } });
    }
}
```

**修改后**：

```javascript
async function processOrderCancel(cancelData) {
    const { orderNo, goodsId, userId, count, reason, packageItemId, roomTypeId, dateRange } = cancelData; // ✅ 增加套餐字段

    try {
        // ... 查询订单、校验状态

        // ✅ 根据订单类型选择不同的恢复逻辑
        if (packageItemId && roomTypeId && dateRange) {
            // 套餐订单：使用 comboPurchaseService.refundStock 恢复
            console.log(`[CancelWorker] 套餐订单取消，恢复库存: packageItemId=${packageItemId}, roomTypeId=${roomTypeId}`);
            for (const date of dateRange) {
                const stockKeys = [
                    `combo:stock:${packageItemId}:${date}`,
                    `hotel:roomtype:stock:${roomTypeId}:${date}`
                ];
                await comboPurchaseService.refundStock(stockKeys, count);
                console.log(`[CancelWorker] 已恢复 ${date} 的库存: +${count}`);
            }
        } else {
            // 票务订单：原有逻辑不变
            await redisService.incrFun(`ticket:stock:${goodsId}`, count);
            const ticket = await Ticket.findOne({ where: { id: goodsId } });
            if (ticket) {
                await ticket.increment('remainingStock', { by: count });
                await ticket.decrement('soldCount', { by: count });
            }
            const orderPurchaseKey = `purchase:${userId}:${goodsId}:${orderNo}`;
            await redisService.delFun(orderPurchaseKey);
        }

        await Order.update({
            orderStatus: 3,
            verifyStatus: 3,
            cancelReason: reason,
            cancelTime: new Date()
        }, { where: { orderNumber: orderNo } });
    }
}
```

---

## 五、修改文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `workers/orderWorker.js` | 修改 | 1. 顶部加载 comboPurchaseService<br>2. processPackageOrder 新增 Order.create<br>3. processOrderCancel 增加套餐分支 |
| `services/basePurchaseService.js` | 修改 | 1. 新增 _ensureScriptLoaded 方法<br>2. deductStock/refundStock 调用前检查脚本就绪 |
| `models/orderModel/index.js` | 修改 | 1. 新增 orderType 字段<br>2. 5个票务字段改为 allowNull: true |
| `migrations/20260529000000-add-orderType-and-relax-orders-fields.js` | 新增 | 数据库迁移：同步模型变更 |

---

## 六、修复后的完整执行流程

```
用户购买套餐
    │
    ├─ buyCombo 接口
    │   ├─ 校验参数、套餐、用户
    │   ├─ 初始化 Redis 库存（如不存在）
    │   ├─ 逐日扣减库存（Redis Lua 原子操作）
    │   ├─ 构建订单数据
    │   ├─ 发送 MQ 异步处理（addOrderJob）
    │   └─ 发送延迟取消任务（addCancelJob，10分钟后）
    │
    ├─ OrderWorker 消费订单
    │   ├─ processPackageOrder
    │   │   ├─ 查询 PackageItem ✅
    │   │   ├─ 创建 Order 主订单 ✅ ← 修复：先创建主记录满足外键约束
    │   │   ├─ 创建 PackageOrderDetail ✅ ← 不再报外键错误
    │   │   └─ 缓存到 Redis ✅
    │   │
    │   └─ 失败回滚（如需）
    │       └─ rollbackPackageStock
    │           └─ comboPurchaseService.refundStock ✅ ← 修复：脚本按需加载，不再报 undefined
    │
    └─ 10分钟后超时取消（如未支付）
        └─ processOrderCancel
            ├─ 套餐订单 → comboPurchaseService.refundStock ✅ ← 修复：新增套餐分支
            └─ 票务订单 → 原有逻辑不变
```

---

## 七、数据库迁移执行

迁移已成功执行：

```bash
npx sequelize-cli db:migrate

# 输出：
# == 20260529000000-add-orderType-and-relax-orders-fields: migrating =======
# == 20260529000000-add-orderType-and-relax-orders-fields: migrated (0.614s)
```

如需回滚：

```bash
npx sequelize-cli db:migrate:undo --name 20260529000000-add-orderType-and-relax-orders-fields.js
```
