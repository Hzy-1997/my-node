--[[
描述: 
版本: 
作者: 
日期: ${year}-${month}-${day}
最后编辑者: sueRimn
最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
--]]
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