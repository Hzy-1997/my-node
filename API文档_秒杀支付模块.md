# 秒杀支付模块 API 文档

> 文件路径: `routes/managementSystem/payment/seckillPayment.js`
>
> 架构: Redis扣减库存 -> 发送MQ -> 立即返回 -> 异步同步数据库

---

## 一、订单相关接口

### 1. 创建订单（高并发抢票）

**接口说明**: 核心抢票接口，支持普通抢票和选座抢票，5ms内返回

- **URL**: `/api/seckill/createOrder`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名  | 类型          | 必填 | 说明                       |
| ------- | ------------- | ---- | -------------------------- |
| goodsId | number/string | 是   | 商品/票务ID                |
| userId  | number/string | 是   | 用户ID                     |
| count   | number        | 是   | 购买数量                   |
| seats   | array         | 否   | 选座信息（选座抢票时必填） |

**seats 数组元素结构**:

```json
{
  "row": 1,
  "col": 5,
  "seatNo": "1排5座"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "抢单成功",
  "data": {
    "orderNo": "ORD202504110001",
    "queuePosition": 15
  }
}
```

**错误码**:

- 商品不存在
- 用户不存在
- 会员等级不足
- 商品尚未上线
- 售卖尚未开始/已结束
- 超出购买限制
- 库存不足
- 座位已被锁定

---

### 2. 查询订单列表

- **URL**: `/api/seckill/queryOrderList`
- **Method**: `GET`

**请求参数**:

| 参数名     | 类型   | 必填 | 说明                     |
| ---------- | ------ | ---- | ------------------------ |
| outTradeNo | string | 否   | 订单号（模糊查询）       |
| userPhone  | string | 否   | 用户手机号（模糊查询）   |
| userIdCard | string | 否   | 用户身份证号（模糊查询） |
| pageNum    | number | 否   | 页码，默认1              |
| pageSize   | number | 否   | 每页条数，默认10         |

**响应示例**:

```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "orderList": [...],
    "total": 100
  }
}
```

---

## 二、座位相关接口（选座抢票）

### 3. 获取座位图及实时状态

- **URL**: `/api/seckill/getSeatMap/:ticketId`
- **Method**: `GET`

**请求参数**:

| 参数名   | 类型   | 必填 | 说明              |
| -------- | ------ | ---- | ----------------- |
| ticketId | string | 是   | 票务ID（URL参数） |

**响应示例**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "seatMap": {
      "rows": 10,
      "cols": 15,
      "seatName": "VIP区",
      "layout": [
        {
          "row": 1,
          "col": 1,
          "seatNo": "1排1座",
          "status": 1,
          "type": "normal"
        }
      ]
    },
    "price": 199.0,
    "maxPurchaseQuantity": 4
  }
}
```

**座位状态说明**:

- 1: 可选
- 2: 已锁定
- 3: 已售出
- 4: 不可选（ blocked ）

---

### 4. 锁定座位

**接口说明**: 选座时先锁定座位，锁定时间3分钟

- **URL**: `/api/seckill/lockSeat`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名   | 类型          | 必填 | 说明                   |
| -------- | ------------- | ---- | ---------------------- |
| ticketId | number/string | 是   | 票务ID                 |
| row      | number        | 是   | 行号                   |
| col      | number        | 是   | 列号                   |
| seatNo   | string        | 否   | 座位号，不传则自动生成 |
| userId   | number/string | 是   | 用户ID                 |

**响应示例**:

```json
{
  "code": 200,
  "message": "锁定成功",
  "data": {
    "expireTime": "2025-04-11T10:30:00Z"
  }
}
```

---

### 5. 取消单个座位锁定

- **URL**: `/api/seckill/unlockSeat`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名   | 类型          | 必填 | 说明   |
| -------- | ------------- | ---- | ------ |
| ticketId | number/string | 是   | 票务ID |
| row      | number        | 是   | 行号   |
| col      | number        | 是   | 列号   |
| userId   | number/string | 是   | 用户ID |

**响应示例**:

```json
{
  "code": 200,
  "message": "释放成功",
  "data": {}
}
```

---

### 6. 释放所有座位（换座）

- **URL**: `/api/seckill/releaseAllSeats`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名   | 类型          | 必填 | 说明   |
| -------- | ------------- | ---- | ------ |
| ticketId | number/string | 是   | 票务ID |
| userId   | number/string | 是   | 用户ID |

**响应示例**:

```json
{
  "code": 200,
  "message": "释放成功",
  "data": {}
}
```

---

## 三、库存相关接口

### 7. 预热库存

**接口说明**: 活动开始前将数据库库存加载到Redis

- **URL**: `/api/seckill/warmupStock`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名  | 类型          | 必填 | 说明                       |
| ------- | ------------- | ---- | -------------------------- |
| goodsId | number/string | 否   | 商品ID，不传则预热所有商品 |

**响应示例**:

```json
{
  "code": 200,
  "message": "库存预热完成",
  "data": {
    "goodsId": 1,
    "stock": 1000,
    "title": "演唱会门票"
  }
}
```

---

### 8. 获取实时库存

**接口说明**: 从Redis读取实时库存

- **URL**: `/api/seckill/getRealTimeStock/:goodsId`
- **Method**: `GET`

**请求参数**:

| 参数名  | 类型   | 必填 | 说明              |
| ------- | ------ | ---- | ----------------- |
| goodsId | string | 是   | 商品ID（URL参数） |

**响应示例**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "goodsId": 1,
    "redisStock": 856,
    "dbStock": 1000,
    "soldCount": 144,
    "title": "演唱会门票"
  }
}
```

---

## 四、支付相关接口

### 9. 支付宝支付

- **URL**: `/api/seckill/payment`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名      | 类型          | 必填 | 说明           |
| ----------- | ------------- | ---- | -------------- |
| outTradeNo  | string        | 是   | 商户订单号     |
| subject     | string        | 是   | 订单标题       |
| totalAmount | string/number | 是   | 订单金额（元） |

**响应示例**:

```json
{
  "code": 200,
  "message": "支付成功",
  "data": "https://openapi.alipay.com/gateway.do?..." // 支付宝支付链接
}
```

---

### 10. 支付宝回调通知

**接口说明**: 支付宝支付结果异步通知（由支付宝调用）

- **URL**: `/api/seckill/notify`
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded`

**请求参数**: 支付宝标准回调参数

**响应**: 返回 `success` 或 `fail`

---

### 11. 支付宝退款

- **URL**: `/api/seckill/refund`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数**:

| 参数名      | 类型   | 必填 | 说明   |
| ----------- | ------ | ---- | ------ |
| orderNumber | string | 是   | 订单号 |

**响应示例**:

```json
{
  "code": 200,
  "message": "退款成功",
  "data": {
    "orderNumber": "ORD202504110001",
    "refundAmount": 199.0,
    "restoredStock": 1
  }
}
```

---

## 五、监控/管理接口

### 12. 获取队列状态

**接口说明**: 获取消息队列状态（监控用）

- **URL**: `/api/seckill/getQueueStatus`
- **Method**: `GET`

**响应示例**:

```json
{
  "code": 200,
  "message": "队列状态",
  "data": {
    "pending": 10,
    "processing": 2,
    "completed": 100
  }
}
```

---

### 13. 手动触发每日重置

**接口说明**: 重置每日购买限制（测试/管理用）

- **URL**: `/api/seckill/dailyReset`
- **Method**: `POST`

**响应示例**:

```json
{
  "code": 200,
  "message": "每日重置完成",
  "data": {
    "resetCount": 50
  }
}
```

---

## 附录

### 响应格式统一说明

**成功响应**:

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

**失败响应**:

```json
{
  "code": 500,
  "message": "错误信息",
  "data": null
}
```

### 订单状态说明

| 状态码 | 说明   |
| ------ | ------ |
| 1      | 待支付 |
| 2      | 已支付 |
| 3      | 已核销 |
| 4      | 已过期 |
| 5      | 已退款 |

### 测试流程建议

1. **预热库存**: 调用 `warmupStock` 将库存加载到Redis
2. **获取座位图**（选座模式）: 调用 `getSeatMap` 查看可选座位
3. **锁定座位**（选座模式）: 调用 `lockSeat` 锁定心仪座位
4. **创建订单**: 调用 `createOrder` 提交订单
5. **支付**: 调用 `payment` 获取支付链接完成支付
6. **查询**: 调用 `queryOrderList` 查询订单状态
