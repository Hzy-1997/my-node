/**
 * 抢票功能示例路由
 * 
 * 该模块提供了抢票系统的RESTful API接口，展示了如何在高并发场景下
 * 使用Redis连接池和分布式锁实现安全、高效的抢票功能。
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-11-01
 */
const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');

/**
 * 初始化票库存接口
 * 用于将票信息和库存从数据库同步到Redis缓存
 * 
 * @name 初始化票库存
 * @path POST /api/ticket/tickets/init
 * @param {string} req.body.ticketId - 票ID
 * @param {number} req.body.stock - 初始库存数量
 * @returns {Object} 操作结果
 */
router.post('/tickets/init', async (req, res) => {
  try {
    const { ticketId, stock } = req.body;

    // 参数校验
    if (!ticketId || stock === undefined || stock < 0) {
      return res.status(400).json({ success: false, message: 'Invalid ticketId or stock' });
    }

    // 在实际应用中，这里应该先检查数据库中的库存，然后同步到Redis
    await redisService.initializeTicketStock({ id: ticketId, stock });

    return res.json({ success: true, message: 'Ticket stock initialized', ticketId, stock });
  } catch (error) {
    console.error('Initialize ticket error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * 获取票库存信息接口
 * 实时查询Redis中的票库存状态
 * 
 * @name 获取票库存
 * @path GET /api/ticket/tickets/:ticketId/stock
 * @param {string} req.params.ticketId - 票ID
 * @returns {Object} 包含当前库存的信息
 */
router.get('/tickets/:ticketId/stock', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const stock = await redisService.get(`ticket:stock:${ticketId}`, false);

    return res.json({
      success: true,
      ticketId,
      stock: stock ? parseInt(stock) : 0
    });
  } catch (error) {
    console.error('Get ticket stock error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * 抢票接口（核心功能）
 * 实现高并发下的安全抢票，防止超卖和重复购买
 * 
 * @name 抢购门票
 * @path POST /api/ticket/tickets/:ticketId/purchase
 * @param {string} req.params.ticketId - 票ID
 * @param {string} req.body.userId - 用户ID
 * @param {number} [req.body.quantity=1] - 购买数量
 * @returns {Object} 抢购结果
 */
router.post('/tickets/:ticketId/purchase', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId, quantity = 1 } = req.body;

    // 参数校验
    if (!ticketId || !userId) {
      return res.status(400).json({ success: false, message: 'ticketId and userId are required' });
    }

    // 1. 检查用户是否已经抢购过（防止重复抢购，可根据业务需求调整）
    const hasPurchased = await redisService.get(`purchase:${userId}:${ticketId}`);
    if (hasPurchased) {
      return res.status(400).json({ success: false, message: 'You have already purchased this ticket' });
    }

    // 2. 使用Redis连接池和分布式锁实现高并发抢票
    const result = await redisService.checkAndDecreaseStock(ticketId, quantity);

    if (result.success) {
      // 3. 记录用户抢购记录（实际应用中还需要写入数据库）
      await redisService.set(`purchase:${userId}:${ticketId}`, {
        userId,
        ticketId,
        quantity,
        purchaseTime: new Date().toISOString()
      }, 86400); // 缓存一天

      // 4. 在实际应用中，这里应该异步写入数据库，使用消息队列等机制
      // 此处省略数据库操作

      return res.json({
        success: true,
        message: 'Purchase successful!',
        ticketId,
        quantity,
        remainingStock: result.newStock
      });
    } else {
      return res.status(400).json({ success: false, message: 'Purchase failed' });
    }
  } catch (error) {
    console.error('Purchase ticket error:', error);
    // 根据错误类型返回不同的响应，提供更好的用户体验
    if (error.message === 'Insufficient stock') {
      return res.status(400).json({ success: false, message: 'Sorry, tickets are sold out' });
    } else if (error.message === 'Failed to acquire lock, please try again') {
      return res.status(429).json({ success: false, message: 'Too many people are purchasing, please try again' });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * 取消抢购接口
 * 恢复库存并删除购买记录
 * 
 * @name 取消抢购
 * @path POST /api/ticket/tickets/:ticketId/cancel
 * @param {string} req.params.ticketId - 票ID
 * @param {string} req.body.userId - 用户ID
 * @returns {Object} 取消结果
 */
router.post('/tickets/:ticketId/cancel', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId } = req.body;

    // 参数校验
    if (!ticketId || !userId) {
      return res.status(400).json({ success: false, message: 'ticketId and userId are required' });
    }

    // 获取用户抢购记录
    const purchaseRecord = await redisService.get(`purchase:${userId}:${ticketId}`);
    if (!purchaseRecord) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    // 使用分布式锁保证库存恢复的原子性
    const lockName = `ticket:lock:${ticketId}`;
    const lockValue = await redisService.acquireLockWithRetry(lockName);

    if (!lockValue) {
      return res.status(429).json({ success: false, message: 'System busy, please try again' });
    }

    try {
      // 恢复库存
      const client = await redisService.pool.getClient();
      try {
        await client.incrBy(`ticket:stock:${ticketId}`, purchaseRecord.quantity);
      } finally {
        await redisService.pool.releaseClient(client);
      }

      // 删除抢购记录
      await redisService.del(`purchase:${userId}:${ticketId}`);

      // 在实际应用中，这里也需要更新数据库

      return res.json({ success: true, message: 'Purchase canceled successfully' });
    } finally {
      // 确保释放锁
      await redisService.releaseLock(lockName, lockValue);
    }
  } catch (error) {
    console.error('Cancel purchase error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;