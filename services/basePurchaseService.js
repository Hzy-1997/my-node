/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const fs = require("fs");  // 文件模块
const path = require("path");  // 路径模块
const { RedisService } = require("./redisService");  // Redis服务模块

class BasePurchaseService extends RedisService {

    constructor() {
        super();
        this.luaDir = path.join(__dirname, "../lua/common"); // lua脚本存放目录
        this.scripts = {
            stockDeduct: fs.readFileSync(
                path.join(this.luaDir, "stock_deduct.lua"),
                "utf8"
            ),
            stockRefund: fs.readFileSync(
                path.join(this.luaDir, "stock_refund.lua"),
                "utf8"
            )
        };
        this.scriptSha = {};
        this._initScripts();
    }
    async _initScripts() {
        try {
            for (const [name, script] of Object.entries(this.scripts)) {
                this.scriptSha[name] = await this.scriptLoad(script);
                console.log(`[BasePurchase] 脚本加载成功: ${name}`);
            }
        } catch (error) {
            console.error("[BasePurchase] 脚本加载失败:", error);
        }
    }

    async scriptLoad(script) {
        let client = null;
        try {
            client = await this.pool.getClient();
            return await client.scriptLoad(script);
        } finally {
            if (client) await this.pool.releaseClient(client);
        }
    }

    async _ensureScriptLoaded(name) {
        if (!this.scriptSha[name]) {
            this.scriptSha[name] = await this.scriptLoad(this.scripts[name]);
            console.log(`[BasePurchase] 脚本按需加载成功: ${name}`);
        }
    }


    /**
     * 通用库存扣减方法
     * @param {string[]} stockKeys - 库存key列表
     * @param {number} quantity - 购买数量
     * @param {number} userId - 用户ID
     * @param {string} orderNo - 订单号
     */
    async deductStock(stockKeys, quantity, userId, orderNo) {
        const expireTime = Date.now() + 86400 * 1000;

        let client = null;
        try {
            await this._ensureScriptLoaded('stockDeduct');
            client = await this.pool.getClient();
            const result = await client.evalSha(this.scriptSha.stockDeduct, {
                keys: stockKeys,
                arguments: [String(quantity), String(userId), orderNo, String(expireTime)]
            });
            return JSON.parse(result);
        } catch (error) {
            console.error("[BasePurchase] 库存扣减失败:", error);
            throw error;
        } finally {
            if (client) await this.pool.releaseClient(client);
        }
    }

    /**
     * 通用库存恢复方法
     * @param {string[]} stockKeys - 库存key列表
     * @param {number} quantity - 恢复数量
     */
    async refundStock(stockKeys, quantity) {
        let client = null;
        try {
            await this._ensureScriptLoaded('stockRefund');
            client = await this.pool.getClient();
            const result = await client.evalSha(this.scriptSha.stockRefund, {
                keys: stockKeys,
                arguments: [String(quantity)]
            });
            return JSON.parse(result);
        } catch (error) {
            console.error("[BasePurchase] 库存恢复失败:", error);
            throw error;
        } finally {
            if (client) await this.pool.releaseClient(client);
        }
    }

    /**
     * 生成日期范围
     */
    generateDateRange(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        while (start <= end) {
            dates.push(start.toISOString().split('T')[0]);
            start.setDate(start.getDate() + 1);
        }
        return dates;
    }

    /**
     * 初始化库存到Redis ，默认过期时间为1小时
     */
    async initializeStock(key, stock, expireSeconds = 86400) {
        console.log("初始化库存到Redis", key, stock, expireSeconds)
        await this.setFun(key, stock, expireSeconds);
    }
}


module.exports = BasePurchaseService;