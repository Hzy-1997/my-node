# Lua 零基础入门教程（Redis 专用版）

> 本文档从零开始教 Lua，专门针对 Redis Lua 脚本场景，不需要任何编程基础

---

## 一、Lua 是什么？

### 1.1 简单理解

Lua 就像是一种**简单的指令语言**，告诉电脑一步一步做什么。

**类比**：
- 像菜谱：第一步做什么，第二步做什么...
- 像乐高说明书：按步骤组装

### 1.2 为什么 Redis 用 Lua？

```
普通方式（不用 Lua）：
  客户端 ──▶ Redis: 查库存
  客户端 ◀── Redis: 库存=100
  客户端 ──▶ Redis: 减库存
  客户端 ◀── Redis: 库存=99
  【问题：这两步之间可能被其他用户打断，导致超卖】

Lua 脚本方式：
  客户端 ──▶ Redis: 执行这段 Lua 脚本
  Redis 内部：查库存 → 减库存（一步完成，不会被打断）
  客户端 ◀── Redis: 结果
  【安全：原子操作，不会超卖】
```

---

## 二、Lua 基础语法（超简单版）

### 2.1 变量 - 存储数据

```lua
-- 创建变量（就像贴标签）
local name = "张三"      -- 字符串（文字）
local age = 25           -- 数字
local isVip = true       -- 布尔值（是/否）

-- 使用变量
print(name)              -- 输出：张三
print(age)               -- 输出：25
```

**关键字 `local`**：表示这个变量只在当前代码块有效

### 2.2 数据类型

| 类型 | 示例 | 说明 |
|------|------|------|
| `nil` | `local a = nil` | 空，什么都没有 |
| `boolean` | `local flag = true` | true（真）或 false（假）|
| `number` | `local num = 100` | 数字 |
| `string` | `local str = "hello"` | 字符串（文字）|
| `table` | `local t = {1, 2, 3}` | 表（数组或对象）|
| `function` | `local f = function() end` | 函数 |

### 2.3 条件判断 - if 语句

```lua
local score = 85

if score >= 90 then
    print("优秀")
elseif score >= 60 then
    print("及格")
else
    print("不及格")
end
```

**执行流程**：
```
score = 85
    │
    ▼
score >= 90 ? ──否──▶ score >= 60 ? ──是──▶ 输出"及格"
```

### 2.4 循环 - for 语句

```lua
-- 循环 5 次
for i = 1, 5 do
    print("第" .. i .. "次")
end

-- 输出：
-- 第1次
-- 第2次
-- 第3次
-- 第4次
-- 第5次
```

### 2.5 表（Table）- 最重要的数据结构

表是 Lua 中唯一的数据结构，可以用来做**数组**或**对象**。

#### 作为数组使用

```lua
-- 创建数组
local fruits = {"苹果", "香蕉", "橘子"}

-- 获取元素（注意：Lua 索引从 1 开始！）
print(fruits[1])   -- 输出：苹果
print(fruits[2])   -- 输出：香蕉

-- 获取长度
print(#fruits)     -- 输出：3

-- 添加元素
 table.insert(fruits, "葡萄")
-- fruits = {"苹果", "香蕉", "橘子", "葡萄"}

-- 遍历数组
for i, fruit in ipairs(fruits) do
    print(i, fruit)
end
```

#### 作为对象使用（键值对）

```lua
-- 创建对象
local user = {
    name = "张三",
    age = 25,
    vip = true
}

-- 获取属性
print(user.name)    -- 输出：张三
print(user.age)     -- 输出：25

-- 修改属性
user.age = 26

-- 添加属性
user.email = "zhangsan@example.com"

-- 遍历对象
for key, value in pairs(user) do
    print(key, value)
end
```

---

## 三、Redis 专用语法

### 3.1 KEYS 和 ARGV

这是 Redis Lua 脚本**最重要的两个变量**：

```lua
-- KEYS: Redis 的键名（用于集群路由）
-- ARGV: 普通参数

-- 示例调用（从 Node.js）：
-- eval "脚本" 2 key1 key2 arg1 arg2
--               ↑ 两个 KEYS
--                   ↑ 两个 ARGV

-- 在 Lua 中接收：
local myKey = KEYS[1]      -- "key1"
local anotherKey = KEYS[2] -- "key2"
local param1 = ARGV[1]     -- "arg1"
local param2 = ARGV[2]     -- "arg2"
```

**为什么分开 KEYS 和 ARGV？**
- KEYS 告诉 Redis 这个脚本操作哪些 key（集群模式下需要）
- ARGV 是普通参数

### 3.2 调用 Redis 命令

```lua
-- 基本格式：redis.call('命令名', 参数1, 参数2, ...)

-- GET: 获取值
local value = redis.call('GET', 'mykey')

-- SET: 设置值
redis.call('SET', 'mykey', 'myvalue')

-- 带过期时间的 SET
redis.call('SET', 'mykey', 'myvalue', 'EX', 3600)  -- 3600秒后过期

-- HGET: 获取 Hash 字段
local fieldValue = redis.call('HGET', 'hashkey', 'fieldname')

-- HSET: 设置 Hash 字段
redis.call('HSET', 'hashkey', 'fieldname', 'fieldvalue')

-- DECRBY: 减少数值
local newValue = redis.call('DECRBY', 'counter', 5)  -- 减少 5

-- TIME: 获取服务器时间
local now = redis.call('TIME')  -- 返回 [秒, 微秒]
```

### 3.3 类型转换

```lua
-- Redis 返回的都是字符串，需要转成数字才能计算
local stock = redis.call('GET', 'stock:1001')  -- "100"
local numStock = tonumber(stock)                -- 100（数字）

-- 数字转字符串
local num = 100
local str = tostring(num)  -- "100"

-- 时间戳计算
local now = redis.call('TIME')  -- [1712812345, 678901]
local seconds = tonumber(now[1])      -- 1712812345
local microseconds = tonumber(now[2]) -- 678901
local milliseconds = seconds * 1000 + microseconds / 1000
```

---

## 四、实战：写一个完整的 Lua 脚本

### 4.1 需求：简单的计数器

**功能**：
1. 获取当前计数
2. 增加指定数量
3. 返回新的计数

**代码**：

```lua
-- counter.lua
-- 参数: KEYS[1]计数器key, ARGV[1]增加的数量

local key = KEYS[1]           -- 获取 key
local increment = tonumber(ARGV[1])  -- 获取增加量，转为数字

-- 获取当前值
local current = redis.call('GET', key)
if not current then
    current = 0  -- 如果不存在，从 0 开始
else
    current = tonumber(current)
end

-- 计算新值
local newValue = current + increment

-- 保存新值
redis.call('SET', key, newValue)

-- 返回结果（简单字符串）
return "新计数: " .. newValue
```

**Node.js 调用**：

```javascript
const result = await client.eval(
    luaScript,
    {
        keys: ['my:counter'],
        arguments: ['5']
    }
);
console.log(result);  // "新计数: 5"
```

### 4.2 需求：检查并设置

**功能**：
1. 检查 key 是否存在
2. 不存在才设置值
3. 返回是否设置成功

**代码**：

```lua
-- set_if_not_exists.lua
-- 参数: KEYS[1]key, ARGV[1]value

local key = KEYS[1]
local value = ARGV[1]

-- 检查是否存在
local exists = redis.call('EXISTS', key)

if exists == 1 then
    -- 已存在
    return "失败：key 已存在"
else
    -- 不存在，设置值
    redis.call('SET', key, value)
    return "成功：设置完成"
end
```

---

## 五、常用技巧

### 5.1 字符串拼接

```lua
local name = "张三"
local age = 25

-- 使用 .. 拼接字符串
local info = "姓名: " .. name .. ", 年龄: " .. age
-- 结果："姓名: 张三, 年龄: 25"
```

### 5.2 判断 nil

```lua
local value = redis.call('GET', 'maybe:exists')

if value == nil then
    print("key 不存在")
else
    print("值为: " .. value)
end

-- 简写
if not value then
    print("key 不存在或为 nil")
end
```

### 5.3 数学运算

```lua
local a = 10
local b = 3

print(a + b)   -- 13
print(a - b)   -- 7
print(a * b)   -- 30
print(a / b)   -- 3.333...
print(a % b)   -- 1（取余）
print(a ^ b)   -- 1000（幂运算）

-- 常用函数
print(math.floor(3.7))   -- 3（向下取整）
print(math.ceil(3.2))    -- 4（向上取整）
print(math.max(1, 5, 3)) -- 5（最大值）
print(math.min(1, 5, 3)) -- 1（最小值）
```

### 5.4 时间处理

```lua
-- 获取 Redis 服务器时间
local now = redis.call('TIME')
-- now = [秒, 微秒]

-- 转换为毫秒时间戳
local timestamp = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 计算过期时间（当前时间 + 10分钟）
local expireTime = timestamp + 10 * 60 * 1000

-- 计算 TTL（秒）
local ttlSeconds = math.floor((expireTime - timestamp) / 1000)
```

---

## 六、调试技巧

### 6.1 使用 redis-cli 测试

```bash
# 直接执行 Lua 脚本
redis-cli EVAL "return 'Hello, ' .. KEYS[1]" 1 World
# 输出: "Hello, World"

# 执行复杂脚本
redis-cli EVAL "
  local key = KEYS[1]
  local value = ARGV[1]
  redis.call('SET', key, value)
  return 'OK'
" 1 mykey myvalue
```

### 6.2 打印调试信息

```lua
-- 使用 redis.log 输出调试信息（在 Redis 日志中查看）
redis.log(redis.LOG_NOTICE, "当前值: " .. value)

-- 日志级别
-- redis.LOG_DEBUG    -- 调试
-- redis.LOG_VERBOSE  -- 详细
-- redis.LOG_NOTICE   -- 通知（推荐）
-- redis.LOG_WARNING  -- 警告
```

---

## 七、学习资源推荐

### 在线教程

1. **Lua 官方文档**（英文）
   - https://www.lua.org/docs.html
   - 最权威，但英文

2. **Lua 简明教程**（中文）
   - https://www.runoob.com/lua/lua-tutorial.html
   - 简单易懂，适合入门

3. **Redis Lua 脚本官方文档**
   - https://redis.io/docs/manual/programmability/eval-intro/
   - Redis 官方说明

4. **编程导航 - Lua**
   - https://www.code-nav.cn/roadmap/lua
   - 中文资源汇总

### 练习建议

1. **从简单开始**：先写不需要 Redis 的纯 Lua 脚本
2. **使用 redis-cli**：直接在命令行测试
3. **多看例子**：看项目中的 lua 文件夹里的脚本
4. **动手修改**：试着改一改，看结果变化

---

## 八、常见问题 FAQ

### Q1: Lua 和 JavaScript 有什么区别？

| 特性 | Lua | JavaScript |
|------|-----|------------|
| 索引 | 从 1 开始 | 从 0 开始 |
| 语句结束 | 不需要分号 | 建议加分号 |
| 变量声明 | local | let/const/var |
| 对象 | table | object |
| 拼接字符串 | .. | + |

### Q2: 为什么我的脚本报错 "attempt to concatenate a nil value"？

**原因**：把 nil 和字符串拼接了

```lua
-- 错误
local value = nil
print("值是: " .. value)  -- 报错！

-- 正确
local value = nil
if value then
    print("值是: " .. value)
else
    print("值是 nil")
end
```

### Q3: KEYS 和 ARGV 的索引为什么从 1 开始？

Lua 的设计就是这样，数组索引从 1 开始，不是 0。

```lua
local arr = {"a", "b", "c"}
print(arr[1])  -- "a"（不是 arr[0]！）
print(arr[0])  -- nil（不存在）
```

### Q4: 怎么在 Lua 里写注释？

```lua
-- 单行注释

--[[
    多行
    注释
--]]
```

---

## 总结

学会这些，你就能看懂和修改项目中的 Lua 脚本了：

1. ✅ 变量和类型
2. ✅ if 条件判断
3. ✅ for 循环
4. ✅ table（数组和对象）
5. ✅ KEYS 和 ARGV
6. ✅ redis.call()
7. ✅ 类型转换

**下一步**：试着读项目中的 `ticket_purchase.lua`，看看能不能理解每一行在做什么。
