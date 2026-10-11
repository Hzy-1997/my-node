/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

/**
 * Redis配置文件
 * 
 * 该模块提供了Redis连接和相关功能的配置参数，用于整个应用中Redis的统一配置管理。
 * 支持环境变量覆盖默认配置，方便在不同环境中部署。
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-11-01
 */

module.exports = {
  /**
   * Redis服务器连接信息
   * 优先从环境变量读取配置，提供默认值确保开发环境正常运行
   */


  host: process.env.REDIS_HOST || '127.0.0.1',       // Redis服务器主机地址
  port: process.env.REDIS_PORT || 6379,               // Redis服务器端口
  password: process.env.REDIS_PASSWORD || '',         // Redis服务器密码（如果有）
  database: process.env.REDIS_DB || 0,                // Redis数据库索引

  /**
   * Redis连接池配置
   * 用于控制连接池的行为和性能参数
   */
  pool: {
    maxSize: 50,              // 最大连接数 - 根据并发量调整
    minSize: 5,              // 最小连接数（初始连接数）
    maxWaiting: 100,          // 最大等待连接数
    connectionTimeout: 5000,  // 连接超时时间（毫秒）
    idleTimeout: 300000       // 空闲连接超时时间（毫秒） - 5分钟
  },

  /**
   * 分布式锁配置
   * 用于控制分布式锁的行为，防止在高并发场景下的数据竞争
   */
  lock: {
    expireTime: 10000,        // 锁过期时间（毫秒） - 10秒，防止死锁
    retryDelay: 100,          // 重试延迟（毫秒） - 控制获取锁的频率
    maxRetries: 3             // 最大重试次数 - 失败后重试获取锁的次数
  }
};