-- seat_unlock_single.lua
-- 取消单个座位的锁定（用户取消选择某个座位时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]行号, ARGV[3]列号

local statusKey = KEYS[1]
local userId = ARGV[1]
local row = ARGV[2]
local col = ARGV[3]
local seatKey = row .. ':' .. col

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 检查座位状态
local seatData = redis.call('HGET', statusKey, seatKey)

if not seatData then
    return cjson.encode({
        success = false,
        code = 4001,
        message = '座位不存在'
    })
end

local seatInfo = cjson.decode(seatData)

-- 检查是否是当前用户锁定
if seatInfo.userId ~= userId then
    return cjson.encode({
        success = false,
        code = 4002,
        message = '只能取消自己锁定的座位'
    })
end

-- 检查座位是否已被售出
if seatInfo.status == 3 then
    return cjson.encode({
        success = false,
        code = 4003,
        message = '座位已售出，无法取消'
    })
end

-- 释放座位（恢复为空闲状态）
local newSeatInfo = {
    status = 1,
    userId = nil,
    seatNo = seatInfo.seatNo,
    lockTime = nil,
    expireTime = nil
}

redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))

-- 更新用户已选座位缓存
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)

if userSeats then
    local seatsList = cjson.decode(userSeats)
    local newSeatsList = {}
    
    for i, seat in ipairs(seatsList) do
        if not (seat.row == tonumber(row) and seat.col == tonumber(col)) then
            table.insert(newSeatsList, seat)
        end
    end
    
    if #newSeatsList > 0 then
        redis.call('SET', userSeatKey, cjson.encode(newSeatsList), 'EX', 180)
    else
        redis.call('DEL', userSeatKey)
    end
end

return cjson.encode({
    success = true,
    code = 200,
    seat = {row = tonumber(row), col = tonumber(col), seatNo = seatInfo.seatNo},
    message = '座位已释放'
})