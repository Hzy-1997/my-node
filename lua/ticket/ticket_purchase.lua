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