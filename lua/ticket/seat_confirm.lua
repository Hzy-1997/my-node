-- seat_confirm.lua
-- 确认座位售出（支付成功时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]订单号, ARGV[2]座位数量, ARGV[3+]座位列表(row:col格式)

local statusKey = KEYS[1]
local orderNo = ARGV[1]
local seatCount = tonumber(ARGV[2])
local seats = {}

-- 解析座位列表
for i = 3, #ARGV do
    table.insert(seats, ARGV[i])
end

-- 确认每个座位
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
    
    -- 检查座位是否已被锁定
    if seatInfo.status ~= 2 then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位 ' .. seatKey .. ' 状态异常',
            failedSeat = seatKey
        })
    end
    
    -- 检查是否是当前订单锁定
    if seatInfo.orderNo ~= orderNo then
        return cjson.encode({
            success = false,
            code = 4003,
            message = '座位 ' .. seatKey .. ' 不属于当前订单',
            failedSeat = seatKey
        })
    end
end

-- 标记所有座位为已售出
for i, seatKey in ipairs(seats) do
    local seatData = redis.call('HGET', statusKey, seatKey)
    local seatInfo = cjson.decode(seatData)
    
    local newSeatInfo = {
        status = 3,
        userId = seatInfo.userId,
        seatNo = seatInfo.seatNo,
        orderNo = orderNo,
        lockTime = seatInfo.lockTime,
        soldTime = tonumber(redis.call('TIME')[1]) * 1000
    }
    
    redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))
end

-- 删除订单座位关联
local orderSeatKey = 'order:seat:' .. orderNo
redis.call('DEL', orderSeatKey)

return cjson.encode({
    success = true,
    code = 200,
    seatCount = seatCount,
    message = '座位确认售出成功'
})