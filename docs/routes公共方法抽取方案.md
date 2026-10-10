# routes 接口公共方法抽取方案

> 分析范围：`mynode/node-full-stack/routes` 目录下所有接口文件（managementSystem + mobileApp）
>
> 目的：找出重复定义的工具函数和业务模板代码，抽取到统一的公共文件，提升可维护性

## 1. 现状

当前 `utils/util.js` 已有的公共方法：

| 方法                    | 作用         |
| ----------------------- | ------------ |
| `success / fail`        | 统一响应格式 |
| `formDate / formatTime` | 日期格式化   |
| `generateOrderNo`       | 订单号生成   |
| `pager`                 | 分页参数解析 |
| `excelFile`             | Excel 导出   |
| `encrypt / decrypt`     | 加密解密     |

但 routes 下各接口文件中仍存在大量重复的工具函数定义，**同一段逻辑被复制粘贴到 2~3 个文件中**，改动时需要多处同步修改，容易遗漏。

## 2. 重复代码清单（按严重程度排序）

### 🔴 严重：日期价格计算（6 个函数 × 3 份 = 18 处重复定义）

这是最严重的重复，6 个函数被完整复制到 3 个文件中：

| 重复函数                                                | 作用                                            |
| ------------------------------------------------------- | ----------------------------------------------- |
| `getData(year)`                                         | 调用第三方 API 获取指定年份的节假日数据         |
| `processHolidayData(apiData)`                           | 解析节假日 API 返回值，提取 holiday/makeup 列表 |
| `getWorkdaysAndHolidays(startDate, endDate)`            | 遍历日期区间，标注每个日期是工作日/周末/节假日  |
| `calculateDatePrice(basePrice, dateType, ruleConfig)`   | 根据日期类型和价格规则计算单日价格              |
| `generateDatePrices(basePrice, dateResult, ruleConfig)` | 批量生成日期价格数组                            |
| `calculateDatePrices(ticket, priceRules)`               | 整合上述函数的对外入口                          |

**出现位置（3 份完全相同）：**

| 文件                                                   | 起始行                             |
| ------------------------------------------------------ | ---------------------------------- |
| `routes/managementSystem/ADateConfiguration/index.js`  | L49、L72、L133、L171、L229、L257   |
| `routes/managementSystem/ticketingRouter/ticketing.js` | L365、L456、L509、L542、L594、L616 |
| `routes/mobileApp/ticketingRouter/ticketing.js`        | L122、L147、L201、L234、L285、L307 |

> 这 6 个函数是 ADateConfiguration 模块的核心逻辑，被管理端票务和移动端票务原样复制。任何价格规则调整都需要改 3 处。

---

### 🔴 严重：buildMenuTree 递归构建菜单树（3 份）

```js
const buildMenuTree = (menus, parentId = null) => {
  return menus
    .filter((menu) => menu.parentId === parentId)
    .map((menu) => ({
      ...menu,
      children: buildMenuTree(menus, menu.id),
    }));
};
```

| 文件                                         | 行号 |
| -------------------------------------------- | ---- |
| `routes/managementSystem/userRouter/user.js` | L437 |
| `routes/managementSystem/menuRouter/menu.js` | L155 |
| `routes/managementSystem/roleRouter/role.js` | L171 |

> 同一个递归树构建逻辑，3 个文件各自定义了一份局部函数。

---

### 🟠 中等：generateDateRange 生成日期区间数组（2 份）

```js
function generateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  while (start <= end) {
    dates.push(start.toISOString().split("T")[0]);
    start.setDate(start.getDate() + 1);
  }
  return dates;
}
```

| 文件                                            | 行号 | 实现差异                           |
| ---------------------------------------------- | ---- | ----------------------------------|
| `routes/managementSystem/comboRouter/combo.js` | L393 | while 循环                        |
| `routes/mobileApp/hotelRouter/hotel.js`        | L341 | for 循环（依赖 calculateStayDays） |

> 逻辑相同，实现略有差异，可统一为一个函数。

---

### 🟠 中等：入住晚数/天数计算（3 处相似实现）

| 函数                                   | 文件                                        | 逻辑                                   |
| -------------------------------------- | ------------------------------------------- | -------------------------------------- |
| `calculateStayDays(checkIn, checkOut)` | `mobileApp/hotelRouter/hotel.js:335`        | `Math.ceil((out-in)/86400000)`         |
| `getNightsToCheck(startDate, endDate)` | `managementSystem/hotelRouter/hotel.js:724` | 日期区间数组                           |
| `getHotelNights(checkIn, checkOut)`    | `workers/orderWorker.js`                    | 同样的天数计算                         |
| 内联计算                               | `payment/seckillPayment.js:1162`            | `while(start<end){ nights.push(...) }` |

> 4 处都在算「入住到退房之间的晚数/日期数组」，可统一。

---

### 🟠 中等：分页查询模板（17 处）

以下模板在 17 个接口中重复出现：

```js
const { page = 1, pageSize = 10 } = req.query;
let where = {};
if (keyword) where.field = { [Op.like]: `%${keyword}%` };

const { rows, count } = await Model.findAndCountAll({
  where,
  offset: (parseInt(page) - 1) * parseInt(pageSize),
  limit: parseInt(pageSize),
  order: [["id", "DESC"]],
});

return res.json(util.success("获取成功", { rows: util.formDate(rows), count }));
```

**出现位置（部分）：**

| 文件                                                  | 行号  | 查询模型       |
| ----------------------------------------------------- | ----- | -------------- |
| `managementSystem/hotelRouter/hotel.js`               | L71   | Hotel          |
| `managementSystem/hotelRouter/hotel.js`               | L177  | RoomType       |
| `managementSystem/hotelRouter/hotel.js`               | L261  | RoomPackage    |
| `managementSystem/hotelRouter/hotel.js`               | L750  | HotelOrder     |
| `managementSystem/hotelRouter/hotel.js`               | L835  | WriteOff       |
| `managementSystem/hotelRouter/hotel.js`               | L1027 | RefundOrder    |
| `managementSystem/comboRouter/combo.js`               | L69   | ProductPackage |
| `managementSystem/comboRouter/combo.js`               | L142  | PackageItem    |
| `managementSystem/ticketingRouter/ticketing.js`       | L714  | WriteOff       |
| `managementSystem/payment/seckillPayment.js`          | L1062 | RefundOrder    |
| `managementSystem/scenicManagementRouter/strategy.js` | L69   | Strategy       |
| `managementSystem/userRouter/user.js`                 | L317  | User           |
| `managementSystem/roleRouter/role.js`                 | L126  | Role           |
| `managementSystem/menuRouter/menu.js`                 | L144  | Menu           |
| `managementSystem/operLogRouter/operLog.js`           | L61   | OperLog        |
| `mobileApp/comboRouter/combo.js`                      | L32   | ProductPackage |
| `mobileApp/scenicManagementRouter/strategy.js`        | L42   | Strategy       |

> `util.pager()` 已存在但**几乎没人用**，因为大家都在手写 offset/limit。可以封装一个更高层的 `paginate(Model, where, options)` 直接返回结果。

---




### 🟡 轻微：OSS 图片删除（1 处，但应前置到 utils）

| 函数          | 文件                                            | 行号 |
| ------------- | ----------------------------------------------- | ---- |
| `deleteImage` | `managementSystem/ticketingRouter/ticketing.js` | L162 |

> 目前定义在票务路由文件内，酒店/套餐后续如果也要删图，应该复用。建议移到 `utils/aliyun.js`。

---



## 3. 建议的公共文件结构

```
utils/
├── util.js              ← 已有，保留通用工具
├── jwt.js               ← 已有
├── aliyun.js            ← 已有
├── log4js.js            ← 已有
├── operLog.js           ← 已有
├── request.js           ← 已有
├── dateHelper.js        ← 新增：日期相关工具
├── priceCalcHelper.js   ← 新增：日期价格计算（6个函数）
├── queryHelper.js       ← 新增：分页查询 + 树构建
├── authHelper.js        ← 新增：Token 解析 + 操作人提取
└── ossHelper.js         ← 新增：OSS 图片删除/上传
```

## 4. 各公共文件职责与方法签名

### 4.1 `utils/dateHelper.js` — 日期工具

```js
// 生成日期区间数组 ['2026-07-21', '2026-07-22', ...]
generateDateRange(startDate, endDate);

// 计算入住晚数（退房-入住的天数差）
calculateNights(checkIn, checkOut);

// 计算两个日期间的天数
diffDays(startDate, endDate);
```

**替换：**

- `combo.js:393` 的 `generateDateRange`
- `mobileApp/hotel.js:341` 的 `generateDateRange` + `calculateStayDays`
- `hotel.js:724` 的 `getNightsToCheck`
- `orderWorker.js` 的 `getHotelNights`
- `seckillPayment.js:1162` 的内联 while 循环

### 4.2 `utils/priceCalcHelper.js` — 日期价格计算

```js
// 获取指定年份的节假日数据
getData(year);

// 解析节假日 API 返回值
processHolidayData(apiData);

// 遍历日期区间，标注工作日/周末/节假日
getWorkdaysAndHolidays(startDate, endDate);

// 根据日期类型和规则计算单日价格
calculateDatePrice(basePrice, dateType, ruleConfig);

// 批量生成日期价格数组
generateDatePrices(basePrice, dateResult, ruleConfig);

// 整合入口：计算票务/房型日期价格
calculateDatePrices(ticket, priceRules);
```

**替换：**

- `ADateConfiguration/index.js` 的 6 个函数 → `require('../../../utils/priceCalcHelper')`
- `ticketingRouter/ticketing.js`（管理端）的 6 个函数 → 同上
- `ticketingRouter/ticketing.js`（移动端）的 6 个函数 → 同上

> 这是收益最大的一次抽取：**18 个重复定义 → 1 份**，价格规则调整只需改 1 处。

### 4.3 `utils/queryHelper.js` — 查询工具

```js
// 通用分页查询
// 用法：const { rows, count } = await paginate(Model, { where, order, attributes })
// 自动从 req.query 解析 page/pageSize，自动 formDate
async paginate(Model, options = {}, req)

// 递归构建树形结构（菜单/部门）
buildTree(list, parentId = null, options = {})
```

**替换：**

- 17 处 `findAndCountAll` 分页模板 → `paginate(Model, { where }, req)`
- 3 处 `buildMenuTree` → `buildTree(menus)`
- `role.js` 的 `permissionIds` 也可一并放入

### 4.4 `utils/authHelper.js` — 鉴权工具

```js
// 从请求头提取操作人信息
// 用法：const operator = await getOperatorFromToken(req)
async getOperatorFromToken(req)

// 从 token 解析用户信息（不抛异常，失败返回 null）
async getUserFromToken(req)
```

**替换：** 14 个文件中重复的 token 解析代码块

### 4.5 `utils/ossHelper.js` — OSS 工具

```js
// 批量删除 OSS 图片
async deleteImages(imageList)

// 删除单张 OSS 图片
async deleteImage(imageUrl)
```

**替换：** `ticketing.js:162` 的 `deleteImage`

## 5. 迁移步骤建议

建议按**收益从大到小、风险从小到大**的顺序迁移：

| 顺序 | 任务                                           | 涉及文件数 | 重复消除数    | 风险                     |
| ---- | ---------------------------------------------- | ---------- | ------------- | ------------------------ |
| 1    | 抽取日期价格计算到 `priceCalcHelper.js`        | 3          | 18 个函数定义 | 低（纯函数，无副作用）   |
| 2    | 抽取 `dateHelper.js`（generateDateRange 等）   | 4          | 5 处          | 低                       |
| 3    | 抽取 `buildTree` 到 `queryHelper.js`           | 3          | 3 处          | 低                       |
| 4    | 抽取 `paginate` 到 `queryHelper.js`            | 17         | 17 处模板     | 中（需逐个验证返回结构） |
| 5    | 抽取 `getOperatorFromToken` 到 `authHelper.js` | 14         | 14 处         | 低                       |
| 6    | 抽取 `deleteImage` 到 `ossHelper.js`           | 1          | 1 处          | 低                       |
| 7    | 抽取退款库存恢复模板                           | 1          | 3 处          | 中（涉及库存，需测试）   |

> 每步迁移后，原文件改为 `require` 引用，删除局部函数定义，逐个接口回归测试。

## 6. 迁移后示例

以票务路由为例，迁移前后对比：

**迁移前（ticketing.js 顶部 200+ 行工具函数）：**

```js
const { eachDayOfInterval, format, isWeekend, parseISO, addDays } = require("date-fns");
const { post } = require("../../../utils/request");

const getData = async (year) => { /* 40 行 */ };
const calculateDatePrices = async (ticket, priceRules) => { /* 50 行 */ };
function processHolidayData(apiData) { /* 30 行 */ };
function getWorkdaysAndHolidays(startDate, endDate) { /* 50 行 */ };
function calculateDatePrice(basePrice, dateType, ruleConfig) { /* 20 行 */ };
function generateDatePrices(basePrice, dateResult, ruleConfig) { /* 30 行 */ };

exports.getTicketList = async (req, res) => { ... };
```

**迁移后：**

```js
const { calculateDatePrices } = require("../../../utils/priceCalcHelper");

exports.getTicketList = async (req, res) => { ... };
```

文件从 700+ 行缩减到 200 行以内，只保留业务接口逻辑。
