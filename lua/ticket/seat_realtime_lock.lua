-- seat_realtime_lock.lua
-- 实时锁定单个座位（用户点击座位时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID, ARGV[2]行号, ARGV[3]列号, ARGV[4]座位名称, ARGV[5]过期时间戳

local statusKey = KEYS[1]
local userId = ARGV[1]
local row = ARGV[2]
local col = ARGV[3]
local seatNo = ARGV[4]
local expireTime = tonumber(ARGV[5])
local seatKey = row .. ':' .. col

-- 获取当前时间戳（毫秒）
local now = redis.call('TIME')
local currentTime = tonumber(now[1]) * 1000 + tonumber(now[2]) / 1000

-- 检查座位当前状态
local seatData = redis.call('HGET', statusKey, seatKey)

if seatData then
    local seatInfo = cjson.decode(seatData)

    -- 检查是否已被其他用户锁定
    if seatInfo.status == 2 then
        -- 检查锁定是否已过期
        if seatInfo.expireTime and seatInfo.expireTime > currentTime then
            return cjson.encode({
                success = false,
                code = 4003,
                message = '座位已被其他用户选择'
            })
        end
        -- 已过期，可以继续锁定
    end

    -- 检查是否已售出
    if seatInfo.status == 3 then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '座位已售出'
        })
    end
end

-- 锁定座位
local newSeatInfo = {
    status = 2,
    userId = userId,
    seatNo = seatNo,
    lockTime = currentTime,
    expireTime = expireTime
}

redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))

-- 更新用户已选座位缓存
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)
local seatsList = {}

if userSeats then
    seatsList = cjson.decode(userSeats)
end

-- 检查是否已存在
local exists = false
for i, seat in ipairs(seatsList) do
    if seat.row == tonumber(row) and seat.col == tonumber(col) then
        exists = true
        break
    end
end

if not exists then
    table.insert(seatsList, {row = tonumber(row), col = tonumber(col)})
end

local ttlSeconds = math.floor((expireTime - currentTime) / 1000)
redis.call('SET', userSeatKey, cjson.encode(seatsList), 'EX', ttlSeconds)

return cjson.encode({
    success = true,
    code = 200,
    seat = {row = tonumber(row), col = tonumber(col), seatNo = seatNo},
    lockTime = currentTime,
    expireTime = expireTime,
    expireSeconds = ttlSeconds
})