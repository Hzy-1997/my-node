-- seat_release_all.lua
-- 释放所有座位（换座/取消时调用）
-- 参数: KEYS[1]座位状态key, ARGV[1]用户ID

local statusKey = KEYS[1]
local userId = ARGV[1]

-- 获取用户已选座位
local userSeatKey = 'user:seat:' .. userId .. ':' .. statusKey
local userSeats = redis.call('GET', userSeatKey)

if not userSeats then
    return cjson.encode({
        success = true,
        code = 200,
        message = '没有需要释放的座位'
    })
end

local seatsList = cjson.decode(userSeats)
local releasedSeats = {}

-- 释放每个座位
for i, seat in ipairs(seatsList) do
    local seatKey = seat.row .. ':' .. seat.col
    local seatData = redis.call('HGET', statusKey, seatKey)
    
    if seatData then
        local seatInfo = cjson.decode(seatData)
        
        -- 检查是否是当前用户锁定
        if seatInfo.userId == userId then
            -- 释放座位（恢复为空闲状态）
            local newSeatInfo = {
                status = 1,
                userId = nil,
                seatNo = seatInfo.seatNo,
                lockTime = nil,
                expireTime = nil
            }
            
            redis.call('HSET', statusKey, seatKey, cjson.encode(newSeatInfo))
            table.insert(releasedSeats, {
                row = seat.row,
                col = seat.col,
                seatNo = seatInfo.seatNo
            })
        end
    end
end

-- 删除用户选座缓存
redis.call('DEL', userSeatKey)

return cjson.encode({
    success = true,
    code = 200,
    seats = releasedSeats,
    message = '所有座位已释放'
})