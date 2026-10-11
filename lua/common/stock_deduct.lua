--[[
描述: 
版本: 
作者: 
日期: ${year}-${month}-${day}
最后编辑者: sueRimn
最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
--]]

-- lua/common/stock_deduct.lua
-- 通用库存扣减脚本（支持N个库存同时扣减）
-- KEYS: 库存key列表
-- ARGV[1]: 购买数量
-- ARGV[2]: 用户ID
-- ARGV[3]: 订单号
-- ARGV[4]: 过期时间戳


local quantity = tonumber(ARGV[1])
local userId = ARGV[2]
local orderNo = ARGV[3]

-- 检查所有库存
for i, stockKey in ipairs(KEYS) do
    local stock = redis.call('GET', stockKey)   -- 获取库存数量
    if not stock then
        return cjson.encode({
            success = false,
            code = 4001,
            message = '库存未初始化: ' .. stockKey
        })
    end
    
    if tonumber(stock) < quantity then
        return cjson.encode({
            success = false,
            code = 4002,
            message = '库存不足: ' .. stockKey
        })
    end
end

-- 扣减所有库存
for i, stockKey in ipairs(KEYS) do
    redis.call('DECRBY', stockKey, quantity)
end

-- 记录购买记录
local purchaseKey = 'purchase:' .. userId .. ':' .. orderNo
redis.call('SET', purchaseKey, cjson.encode({
    userId = userId,
    orderNo = orderNo,
    quantity = quantity,
    time = redis.call('TIME')[1],
    stockKeys = KEYS
}), 'EX', 86400) -- 过期时间为1天

return cjson.encode({
    success = true,
    code = 200,
    message = '库存扣减成功'
})