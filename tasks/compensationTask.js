/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/**
 * 补偿任务处理器
 * 处理座位释放等补偿任务
 */
const cron = require('node-cron');
const { Op, sequelize } = require('sequelize');
const { CompensationTask } = require('../models/Summary');
const ticketPurchaseService = require('../services/ticketPurchaseService');

class CompensationTaskHandler {
  constructor() {
    this.start();
  }

  start() {
    // 每 30 秒执行一次补偿任务
    cron.schedule('*/30 * * * * *', async () => {
      await this.processPendingTasks();
    });

    console.log('[Compensation] 补偿任务处理器已启动');
  }

  /**
   * 处理待处理的补偿任务
   */
  async processPendingTasks() {
    try {
      const pendingTasks = await CompensationTask.findAll({
        where: {
          type: 'seat_release',
          status: 'pending',
          retryCount: {
            [Op.lt]: sequelize.col('maxRetry')
          },
          createdAt: {
            [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内
          }
        },
        limit: 100
      });

      console.log(`[Compensation] 发现 ${pendingTasks.length} 个待处理任务`);

      for (const task of pendingTasks) {
        await this.processTask(task);
      }
    } catch (error) {
      console.error('[Compensation] 处理补偿任务失败:', error);
    }
  }

  /**
   * 处理单个补偿任务
   */
  async processTask(task) {
    try {
      console.log(`[Compensation] 处理任务: ${task.id}, orderNo: ${task.orderNo}`);

      // 调用服务释放座位
      const result = await ticketPurchaseService.releaseAllSeats({
        ticketId: task.ticketId,
        userId: task.userId
      });

      if (result.success) {
        await task.update({
          status: 'success',
          completedAt: new Date()
        });
        console.log(`[Compensation] 任务 ${task.id} 处理成功`);
      } else {
        throw new Error(result.message || '释放座位失败');
      }
    } catch (error) {
      // 增加重试计数
      await task.increment('retryCount');
      console.error(`[Compensation] 任务 ${task.id} 处理失败:`, error);

      // 达到最大重试次数，标记为失败
      if (task.retryCount + 1 >= task.maxRetry) {
        await task.update({
          status: 'failed'
        });
        console.log(`[Compensation] 任务 ${task.id} 达到最大重试次数，标记为失败`);
      }
    }
  }
}

// 导出实例
module.exports = new CompensationTaskHandler();