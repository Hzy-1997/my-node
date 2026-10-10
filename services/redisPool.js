/**
 * Redis连接池实现
 * 
 * 该模块提供了一个高效的Redis连接池实现。
 * 主要特性包括：
 * - 并行初始化连接
 * - 连接复用管理
 * - 等待队列机制
 * - 健康检查
 * - 自动故障恢复
 * - 优雅关闭
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-11-01
 */
const redis = require('redis');

/**
 * Redis连接池类
 * 管理Redis客户端连接的创建、分配、回收和销毁
 */
class RedisPool {
    /**
     * 构造函数
     * @param {Object} config - Redis连接配置对象
     * @param {number} [poolSize=50] - 连接池最大连接数
     */
    constructor(config, poolSize = 50) {
        // 合并默认配置和用户配置
        this.config = {
            ...config,
            socket: {
                connectTimeout: 5000,       // 连接超时时间（毫秒）
                keepAlive: 60000,          // 保持连接活跃（毫秒）
                ...config.socket           // 合并用户提供的socket配置
            }
        };

        this.poolSize = poolSize;          // 最大连接池大小
        this.availableClients = [];        // 可用连接数组
        this.inUseClients = new Set();     // 使用中连接集合
        this.waitingQueue = [];            // 等待连接的请求队列
        this.isInitialized = false;        // 初始化状态标志
        this.initializePromise = this.initializePool(); // 初始化Promise
    }

    /**
     * 并行初始化连接池
     * 使用Promise.all并行创建多个连接，提高初始化效率
     * @async
     * @returns {Promise<void>}
     */
    async initializePool() {
        console.log("我要初始化Redis连接池");
        try {
            const promises = [];
            // 创建指定数量的连接Promise
            for (let i = 0; i < this.poolSize; i++) {
                promises.push(this.createClientFun());
            }

            // 并行等待所有连接创建完成
            this.availableClients = await Promise.all(promises);

            this.isInitialized = true;
            console.log(`Redis pool initialized with ${this.availableClients.length} connections`);

        } catch (error) {
            console.error('Failed to initialize Redis pool:', error);
            throw error;
        }
    }

    /**
     * 创建单个Redis客户端连接
     * 设置错误处理和连接关闭事件监听
     * @async
     * @returns {Promise<RedisClient>} Redis客户端实例
     */
    /**
     * 创建Redis客户端的异步方法
     * @returns {Promise<Object>} 返回创建的Redis客户端实例
     */
    /**
        // 创建Redis客户端，使用配置对象初始化
     * @returns {Promise<Object>} 返回创建好的Redis客户端实例
     */
    async createClientFun() {
        // 创建Redis客户端
        const client = redis.createClient(this.config);
        // // 监听连接成功事件
        // client.on('connect', () => {
        //     console.log('Redis客户端已连接');
        // });

        // // 监听连接就绪事件（表示可以开始执行命令）
        // client.on('ready', () => {
        //     console.log('Redis客户端就绪，可以执行命令');
        // });

        // 增强错误处理 - 当客户端发生错误时自动从池中移除
        client.on('error', (err) => {
            console.error('Redis Client Error:', err);
            // 移除出错的连接
            this.removeClient(client);
        });
        // 连接关闭处理 - 当连接关闭时从池中移除
        client.on('end', () => {
            this.removeClient(client);
        });

        // 建立连接
        await client.connect();
        return client;
    }

    /**
     * 获取Redis连接客户端
     * 实现了等待机制，当没有可用连接时会等待超时
     * @async
     * @param {number} [timeout=10000] - 等待超时时间（毫秒）
     * @returns {Promise<RedisClient>} Redis客户端实例
     * @throws {Error} 当等待超时时抛出错误
     */
    /**
     * 获取一个可用的客户端连接
     * @param {number} timeout - 等待连接的超时时间，默认为10000毫秒
     * @returns {Promise} 返回一个Promise对象，解析为可用的客户端连接
     */
    async getClient(timeout = 10000) {
        console.log("获取一个可用的客户端连接")
        // 确保初始化完成
        if (!this.isInitialized) {
            await this.initializePromise;
        }

        // 检查是否有可用连接
        if (this.availableClients.length > 0) {
            const client = this.availableClients.pop();
            // 健康检查 - 确保获取的连接是可用的
            if (await this.isClientHealthy(client)) {
                this.inUseClients.add(client);
                return client;
            } else {
                // 连接不健康，创建新连接
                return this.createAndUseNewClient();
            }
        }

        // 如果未达到最大连接数，创建新连接
        if (this.inUseClients.size < this.poolSize) {
            return this.createAndUseNewClient();
        }

        // 使用等待队列实现等待机制
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                // 从等待队列中移除超时的请求
                this.waitingQueue = this.waitingQueue.filter(item => item.resolve !== resolve);
                reject(new Error('Timeout waiting for Redis connection'));
            }, timeout);

            // 添加到等待队列
            this.waitingQueue.push({ resolve, timeoutId });
        });
    }

    /**
     * 创建并直接使用新连接
     * 当现有连接不可用时使用此方法
     * @async
     * @returns {Promise<RedisClient>} Redis客户端实例
     */
    async createAndUseNewClient() {
        try {
            const client = await this.createClientFun();
            this.inUseClients.add(client);
            return client;
        } catch (error) {
            console.error('Failed to create new Redis client:', error);
            throw error;
        }
    }

    /**
     * 释放连接回池中
     * 优先分配给等待队列中的请求，其次放回可用连接池
     * @param {RedisClient} client - 要释放的Redis客户端
     */
    releaseClient(client) {
        if (this.inUseClients.has(client)) {
            this.inUseClients.delete(client);

            // 先检查等待队列
            if (this.waitingQueue.length > 0) {
                const { resolve, timeoutId } = this.waitingQueue.shift();
                clearTimeout(timeoutId);
                this.inUseClients.add(client); // 直接分配给等待的请求
                resolve(client);
            } else {
                // 放回可用连接池
                this.availableClients.push(client);
            }
        } else {
            console.warn('Trying to release a client that was not in use.');
        }
    }

    /**
     * 从连接池中移除客户端
     * 当客户端发生错误或关闭时调用
     * @param {RedisClient} client - 要移除的客户端
     */
    removeClient(client) {
        // 从使用中集合移除
        if (this.inUseClients.has(client)) {
            this.inUseClients.delete(client);
        }

        // 从可用连接数组移除
        const index = this.availableClients.indexOf(client);
        if (index > -1) {
            this.availableClients.splice(index, 1);
        }

        // 尝试创建新连接补充池容量
        if (this.totalConnections < this.poolSize && this.isInitialized) {
            this.createClientFun().then(newClient => {
                this.availableClients.push(newClient);
            }).catch(err => console.error('Failed to replace lost client:', err));
        }
    }

    /**
     * 客户端健康检查
     * 通过发送PING命令验证连接是否有效
     * @async
     * @param {RedisClient} client - 要检查的客户端
     * @returns {Promise<boolean>} 连接是否健康
     */
    async isClientHealthy(client) {
        try {
            await client.ping();
            return true;
        } catch (error) {
            console.warn('Redis client health check failed:', error);
            return false;
        }
    }

    // async isClientHealthy(client) {
    //     try {
    //         // 添加 3 秒超时
    //         const timeoutPromise = new Promise((_, reject) => {
    //             setTimeout(() => reject(new Error('Health check timeout')), 3000);
    //         });
    //         await Promise.race([client.ping(), timeoutPromise]);
    //         return true;
    //     } catch (error) {
    //         console.warn('Redis client health check failed:', error);
    //         return false;
    //     }
    // }

    /**
     * 获取总连接数
     * @returns {number} 可用连接和使用中连接的总和
     */
    get totalConnections() {
        return this.availableClients.length + this.inUseClients.size;
    }

    /**
     * 销毁连接池
     * 关闭所有连接并清理资源
     * @async
     * @returns {Promise<void>}
     */
    async destroyPool() {
        // 清除等待队列
        this.waitingQueue.forEach(({ resolve, timeoutId }) => {
            clearTimeout(timeoutId);
            resolve(new Error('Connection pool is being destroyed'));
        });
        this.waitingQueue = [];

        // 关闭所有连接
        const allClients = [...this.availableClients, ...this.inUseClients];
        await Promise.allSettled(
            allClients.map(client => client.quit())
        );

        // 重置状态
        this.availableClients = [];
        this.inUseClients.clear();
        this.isInitialized = false;
        console.log('Redis pool destroyed');
    }
}

module.exports = RedisPool;