/**
 * Redis服务层，封装常用操作
 * 
 * 该模块是Redis操作的统一入口，封装了基础操作。
 * 使用单例模式确保全局只有一个Redis服务实例，并集成了连接池管理。
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-11-01
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-10-31 17:03:28
 */
const RedisPool = require('./redisPool');
const redisConfig = require('../config/redisConfig');

/**
 * 创建全局Redis连接池实例
 * 使用配置文件中的参数初始化连接池
 */



const redisPool = new RedisPool({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  database: redisConfig.database
}, redisConfig.pool.maxSize);

/**
 * Redis服务类
 * 提供Redis操作的封装和业务功能实现
 */
class RedisService {
  /**
   * 构造函数
   * 初始化服务，关联连接池和配置
   */
  constructor() {
    this.pool = redisPool;       // 连接池实例
    this.lockConfig = redisConfig.lock; // 分布式锁配置
  }

  /**
   * 设置键值对
   * 自动处理对象的JSON序列化，支持设置过期时间
   * @async
   * @param {string} key - Redis键名
   * @param {*} value - 要存储的值
   * @param {number|null} [expiration=null] - 过期时间（秒），null表示永不过期
   */
  async setFun(key, value, expiration = null) {
    let client = null;
    try {
      client = await this.pool.getClient();
      // 自动序列化对象
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (expiration) {
        await client.set(String(key), stringValue, { EX: expiration });
      } else {
        await client.set(String(key), stringValue);
      }
    } finally {
      // 确保连接总是被释放
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 获取键值
   * 自动尝试JSON解析，支持原始字符串返回
   * @async
   * @param {string} key - Redis键名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {*} 解析后的值或原始字符串
   */
  async getFun(key, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const value = await client.get(String(key));
      if (value === null) return null;

      // 尝试JSON解析，如果失败则返回原始字符串
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (e) {
          // 如果不是JSON格式，返回原始字符串
          return value;
        }
      }
      return value;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);  //
      }
    }
  }

  /**
   * 原子递增
   * @async
   * @param {string} key - 要递增的键名
   * @returns {number} 递增后的值
   */
  async incrFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.incr(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 原子递减
   * @async
   * @param {string} key - 要递减的键名
   * @returns {number} 递减后的值
   */
  async decrFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.decr(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 添加成员
   * @async
   * @param {string} key - 集合键名
   * @param {string|string[]} members - 要添加的成员，可以是单个成员或成员数组
   * @returns {number} 添加的成员数量
   */
  async saddFun(key, members) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.sAdd(String(key), members);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 获取所有成员
   * @async
   * @param {string} key - 集合键名
   * @returns {string[]} 集合中的所有成员
   */
  async smembersFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.sMembers(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 检查成员是否存在
   * @async
   * @param {string} key - 集合键名
   * @param {string} member - 要检查的成员
   * @returns {boolean} 成员是否存在
   */
  async sismemberFun(key, member) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.sIsMember(String(key), String(member));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 删除成员
   * @async
   * @param {string} key - 集合键名
   * @param {string|string[]} members - 要删除的成员，可以是单个成员或成员数组
   * @returns {number} 删除的成员数量
   */
  async sremFun(key, members) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.sRem(String(key), members);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 获取集合成员数量
   * @async
   * @param {string} key - 集合键名
   * @returns {number} 集合中的成员数量
   */
  async scardFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.sCard(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 集合操作 - 随机弹出成员
   * @async
   * @param {string} key - 集合键名
   * @param {number} [count=1] - 要弹出的成员数量
   * @returns {string[]} 弹出的成员数组（成员不足时返回已有部分，可能为空数组）
   */
  async spopFun(key, count = 1) {
    let client = null;
    try {
      client = await this.pool.getClient();
      // node-redis v5 带数量的 SPOP 是独立方法 sPopCount（sPop 不接受 count 参数），键不存在时返回空数组
      return await client.sPopCount(String(key), count);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 设置字段值
   * @async
   * @param {string} key - 哈希键名
   * @param {string} field - 字段名
   * @param {*} value - 字段值
   * @returns {boolean} 设置是否成功
   */
  async hsetFun(key, field, value) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return await client.hSet(String(key), String(field), stringValue);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 批量设置字段值
   * @async
   * @param {string} key - 哈希键名
   * @param {Object} object - 包含字段和值的对象
   * @returns {number} 设置的字段数量
   */
  async hsetObjFun(key, object) {
    let client = null;
    try {
      client = await this.pool.getClient();
      // 序列化对象中的所有值
      const serializedObject = {};
      for (const [field, value] of Object.entries(object)) {
        serializedObject[field] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
      return await client.hSet(String(key), serializedObject);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 获取字段值
   * @async
   * @param {string} key - 哈希键名
   * @param {string} field - 字段名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {*} 字段值
   */
  async hgetFun(key, field, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const value = await client.hGet(String(key), String(field));
      if (value === null) return null;

      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 获取所有字段和值
   * @async
   * @param {string} key - 哈希键名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {Object} 包含所有字段和值的对象
   */
  async hgetallFun(key, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const values = await client.hGetAll(String(key));

      if (parseJson && values) {
        // 尝试解析每个值
        const parsedValues = {};
        for (const [field, value] of Object.entries(values)) {
          try {
            parsedValues[field] = JSON.parse(value);
          } catch (e) {
            parsedValues[field] = value;
          }
        }
        return parsedValues;
      }

      return values;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 获取所有字段名
   * @async
   * @param {string} key - 哈希键名
   * @returns {string[]} 所有字段名
   */
  async hkeysFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.hKeys(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 获取所有字段值
   * @async
   * @param {string} key - 哈希键名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {Array} 所有字段值
   */
  async hvalsFun(key, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const values = await client.hVals(String(key));

      if (parseJson) {
        return values.map(value => {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        });
      }

      return values;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 删除字段
   * @async
   * @param {string} key - 哈希键名
   * @param {string|string[]} fields - 要删除的字段，可以是单个字段或字段数组
   * @returns {number} 删除的字段数量
   */
  async hdelFun(key, fields) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.hDel(String(key), fields);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 哈希操作 - 检查字段是否存在
   * @async
   * @param {string} key - 哈希键名
   * @param {string} field - 字段名
   * @returns {boolean} 字段是否存在
   */
  async hexistsFun(key, field) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.hExists(String(key), String(field));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 从左侧推入元素
   * @async
   * @param {string} key - 列表键名
   * @param {*} value - 要推入的值
   * @returns {number} 推入后列表的长度
   */
  async lpushFun(key, value) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return await client.lpush(String(key), stringValue);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 从右侧推入元素
   * @async
   * @param {string} key - 列表键名
   * @param {*} value - 要推入的值
   * @returns {number} 推入后列表的长度
   */
  async rpushFun(key, value) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return await client.rpush(String(key), stringValue);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 从左侧弹出元素
   * @async
   * @param {string} key - 列表键名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {*} 弹出的元素
   */
  async lpopFun(key, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const value = await client.lpop(String(key));
      if (value === null) return null;

      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 从右侧弹出元素
   * @async
   * @param {string} key - 列表键名
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {*} 弹出的元素
   */
  async rpopFun(key, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const value = await client.rpop(String(key));
      if (value === null) return null;

      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 获取列表指定范围的元素
   * @async
   * @param {string} key - 列表键名
   * @param {number} start - 起始索引
   * @param {number} stop - 结束索引
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {Array} 指定范围的元素
   */
  async lrangeFun(key, start, stop, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const values = await client.lrange(String(key), start, stop);

      if (parseJson) {
        return values.map(value => {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        });
      }

      return values;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 获取列表长度
   * @async
   * @param {string} key - 列表键名
   * @returns {number} 列表长度
   */
  async llenFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.llen(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 列表操作 - 通过索引获取元素
   * @async
   * @param {string} key - 列表键名
   * @param {number} index - 元素索引
   * @param {boolean} [parseJson=true] - 是否尝试解析JSON
   * @returns {*} 指定索引的元素
   */
  async lindexFun(key, index, parseJson = true) {
    let client = null;
    try {
      client = await this.pool.getClient();
      const value = await client.lindex(String(key), index);
      if (value === null) return null;

      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
  * 删除键
  * @async
  * @param {string} key - 要删除的键名
  * @returns {number} 删除的键数量
  */
  async delFun(key) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.del(String(key));
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 设置键的过期时间
   * @async
   * @param {string} key - 键名
   * @param {number} seconds - 过期时间（秒）
   * @returns {boolean} 设置是否成功
   */
  async expire(key, seconds) {
    let client = null;
    try {
      client = await this.pool.getClient();
      return await client.expire(String(key), seconds);
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 获取分布式锁
   * 使用SET NX命令实现，确保同一时间只有一个客户端可以获取锁
   * @async
   * @param {string} lockName - 锁名称
   * @param {number} [expiration] - 锁过期时间（毫秒）
   * @returns {string|null} 锁值（成功）或null（失败）
   */
  async acquireLock(lockName, expiration = this.lockConfig.expireTime) {
    const lockKey = `lock:${lockName}`;
    const lockValue = this._generateLockValue();
    let client = null;

    try {
      client = await this.pool.getClient();
      // 使用SET NX命令原子性地设置锁，防止竞争条件
      const result = await client.set(lockKey, lockValue, {
        NX: true,  // 只在键不存在时设置
        PX: expiration  // 设置过期时间（毫秒）
      });

      return result === 'OK' ? lockValue : null;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 释放分布式锁
   * 使用Lua脚本确保原子性地检查和释放锁
   * @async
   * @param {string} lockName - 锁名称
   * @param {string} lockValue - 获取锁时返回的锁值
   * @returns {boolean} 是否成功释放锁
   */
  async releaseLock(lockName, lockValue) {
    const lockKey = `lock:${lockName}`;
    let client = null;

    try {
      client = await this.pool.getClient();
      // 使用Lua脚本保证原子性操作，避免释放其他进程的锁
      const script = `
          if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
          else
            return 0
          end
        `;
      const result = await client.eval(script, { keys: [lockKey], arguments: [lockValue] });
      return result === 1;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 带重试机制的分布式锁获取
   * 当锁获取失败时，根据配置的重试次数和延迟时间进行重试
   * @async
   * @param {string} lockName - 锁名称
   * @param {number} [maxRetries] - 最大重试次数
   * @param {number} [retryDelay] - 重试延迟（毫秒）
   * @returns {string|null} 锁值（成功）或null（失败）
   */
  async acquireLockWithRetry(lockName, maxRetries = this.lockConfig.maxRetries, retryDelay = this.lockConfig.retryDelay) {
    for (let i = 0; i <= maxRetries; i++) {
      const lockValue = await this.acquireLock(lockName);
      if (lockValue) {
        return lockValue;
      }

      if (i < maxRetries) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  }

  /**
   * 生成唯一的锁值
   * 用于标识锁的所有者，防止误释放
   * @private
   * @returns {string} 唯一的锁值
   */
  _generateLockValue() {
    // 结合进程ID、时间戳和随机字符串生成唯一值
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * 检查并扣减库存
   * 抢票核心逻辑，使用分布式锁确保并发安全
   * @async
   * @param {string} ticketId - 票ID
   * @param {number} [quantity=1] - 购买数量
   * @returns {Object} 操作结果
   * @throws {Error} 当锁获取失败或库存不足时抛出错误
   */
  async checkAndDecreaseStock(ticketId, quantity = 1) {
    const stockKey = `ticket:stock:${ticketId}`;
    const lockName = `ticket:lock:${ticketId}`;

    // 获取分布式锁
    const lockValue = await this.acquireLockWithRetry(lockName);
    if (!lockValue) {
      throw new Error('Failed to acquire lock, please try again');
    }

    try {
      // 检查库存
      const stock = await this.getFun(stockKey, false);
      if (!stock || parseInt(stock) < quantity) {
        throw new Error('Insufficient stock');
      }

      // 直接从连接池获取客户端进行扣减操作
      const client = await this.pool.getClient();
      try {
        const newStock = await client.decrBy(stockKey, parseInt(quantity));
        return {
          success: true,
          newStock: parseInt(newStock)
        };
      } finally {
        await this.pool.releaseClient(client);
      }
    } finally {
      // 确保无论如何都会释放锁
      await this.releaseLock(lockName, lockValue);
    }
  }

  /**
   * 初始化
   * 从数据库同步库存信息到Redis缓存
   * @async
   * @param {Object} ticketData - 票信息对象
   * @param {string} ticketData.id - 票ID
   * @param {number} ticketData.stock - 库存数量
   * @param {number} ticketData.expire - 缓存时间（秒）
   */
  async initializeTicketStock(ticketData) {
    const stockKey = `ticket:stock:${ticketData.id}`;
    await this.setFun(stockKey, ticketData.stock, ticketData.expire); // 缓存时间为3分钟
  }

  /**
   * 根据模式查找键
   * 使用SCAN命令避免阻塞Redis
   * @async
   * @param {string} pattern - 匹配模式，如 "purchase:*:123"
   * @returns {string[]} 匹配的键名数组
   */
  async keys(pattern) {
    let client = null;
    const keys = [];
    try {
      client = await this.pool.getClient();
      // 使用SCAN命令避免KEYS命令阻塞Redis
      let cursor = '0';
      do {
        const result = await client.scan(cursor, { MATCH: pattern, COUNT: 300 });
        cursor = result.cursor;
        // 确保所有key都是字符串类型
        const stringKeys = result.keys.map(k => String(k));
        keys.push(...stringKeys);
      } while (cursor !== '0');
      return keys;
    } finally {
      if (client) {
        await this.pool.releaseClient(client);
      }
    }
  }

  /**
   * 关闭连接池
   * 应用关闭时调用，确保资源正确释放
   * @async
   */
  async shutdown() {
    await this.pool.destroyPool();
  }
}

/**
 * 创建Redis服务单例实例
 * 全局使用同一个实例，避免重复创建连接池
 */
const redisService = new RedisService();

/**
 * 监听进程退出信号
 * 确保在应用关闭时正确关闭连接池，防止资源泄露
 */
process.on('SIGINT', () => redisService.shutdown());
process.on('SIGTERM', () => redisService.shutdown());

module.exports = redisService;
module.exports.RedisService = RedisService;