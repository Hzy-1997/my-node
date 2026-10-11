-- lua/common/stock_refund.lua
-- 通用库存恢复脚本
-- KEYS: 库存key列表
-- ARGV[1]: 恢复数量

local quantity = tonumber(ARGV[1])  -- 恢复数量，转换为数字类型

for i, stockKey in ipairs(KEYS) do  
    redis.call('INCRBY', stockKey, quantity)
end

return cjson.encode({
    success = true,
    code = 200,
    message = '库存恢复成功'
})