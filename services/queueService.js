/**
 * 消息队列服务
 * 用于高并发场景下的异步处理
 * 支持：订单创建、库存同步、支付回调
 */
const Queue = require('bull');
const redisService = require('./redisService');


const redisConnection = {
    redis: {
        host: redisService.pool.config.host || 'localhost',
        port: redisService.pool.config.port || 6379,
        password: redisService.pool.config.password || undefined,
        db: redisService.pool.config.database || 0,
    }
};

/**
 * 订单队列 - 处理订单创建
 * 并发策略：每秒处理1000个订单，防止数据库压力过大
 */
const orderQueue = new Queue('order creation', redisConnection);

/**
 * 库存同步队列 - 同步Redis库存到数据库
 * 并发策略：批量处理，每5秒或累积100条执行一次
 */
const stockSyncQueue = new Queue('stock sync', redisConnection);

/**
 * 支付回调队列 - 处理支付宝异步通知
 * 并发策略：顺序处理，确保支付状态正确
 */
const paymentQueue = new Queue('payment callback', redisConnection);

/**
 * 订单取消队列 - 处理超时未支付订单
 * 并发策略：延迟执行检查
 */
const cancelQueue = new Queue('order cancel', redisConnection);

/**
 * 添加订单到队列
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object>} 任务信息
 */
async function addOrderJob(orderData) {
    const job = await orderQueue.add(orderData, {
        attempts: 3,           // 失败重试3次
        backoff: {
            type: 'exponential',  // 指数退避
            delay: 1000,          // 初始延迟1秒
        },
        removeOnComplete: 100,    // 保留最近100个完成的任务
        removeOnFail: 50,         // 保留最近50个失败的任务
    });
    return job;
}

/**
 * 添加库存同步任务
 * @param {Object} stockData 库存数据 {goodsId, count, operation}
 * @returns {Promise<Object>} 任务信息
 */
async function addStockSyncJob(stockData) {
    const job = await stockSyncQueue.add(stockData, {
        attempts: 5,
        backoff: {
            type: 'fixed',
            delay: 5000,
        },
        delay: 5000,  // 延迟5秒执行，批量处理
    });
    return job;
}

/**
 * 添加支付回调任务
 * @param {Object} paymentData 支付数据
 * @returns {Promise<Object>} 任务信息
 */
async function addPaymentJob(paymentData) {
    const job = await paymentQueue.add(paymentData, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    });
    return job;
}

/**
 * 添加订单取消任务（延迟执行）
 * @param {Object} cancelData 取消数据
 * @returns {Promise<Object>} 任务信息
 */
async function addCancelJob(cancelData) {
    const job = await cancelQueue.add(cancelData, {
        attempts: 3,
        backoff: {
            type: 'fixed',
            delay: 2000,
        },
        delay: 10 * 60 * 1000, // 10分钟后执行
        removeOnComplete: 100,
        removeOnFail: 50,
    });
    console.log(`[QueueService] 取消任务已创建: ${cancelData.orderNo}, 10分钟后执行`);
    return job;
}

/**
 * 处理订单创建
 * @param {Function} processor 处理函数
 */
function processOrderQueue(processor) {
    // 并发数：5个，防止数据库压力过大
    orderQueue.process(5, async (job) => {
        console.log(`[OrderQueue] 处理订单: ${job.id}`, job.data);
        try {
            const result = await processor(job.data);
            console.log(`[OrderQueue] 订单处理成功: ${job.id}`);
            return result;
        } catch (error) {
            console.error(`[OrderQueue] 订单处理失败: ${job.id}`, error.message);
            throw error;
        }
    });
}

/**
 * 处理库存同步
 * @param {Function} processor 处理函数
 */
function processStockSyncQueue(processor) {
    // 并发数：1个，顺序处理避免竞争
    stockSyncQueue.process(1, async (job) => {
        console.log(`[StockQueue] 同步库存: ${job.data.goodsId}`);
        try {
            const result = await processor(job.data);
            console.log(`[StockQueue] 库存同步成功: ${job.data.goodsId}`);
            return result;
        } catch (error) {
            console.error(`[StockQueue] 库存同步失败: ${job.data.goodsId}`, error.message);
            throw error;
        }
    });
}

/**
 * 处理支付回调
 * @param {Function} processor 处理函数
 */
function processPaymentQueue(processor) {
    // 并发数：3个
    paymentQueue.process(3, async (job) => {
        console.log(`[PaymentQueue] 处理支付: ${job.data.out_trade_no}`);
        try {
            const result = await processor(job.data);
            console.log(`[PaymentQueue] 支付处理成功: ${job.data.out_trade_no}`);
            return result;
        } catch (error) {
            console.error(`[PaymentQueue] 支付处理失败: ${job.data.out_trade_no}`, error.message);
            throw error;
        }
    });
}

/**
 * 处理订单取消
 * @param {Function} processor 处理函数
 */
function processCancelQueue(processor) {
    // 并发数：3个
    cancelQueue.process(3, async (job) => {
        console.log(`[CancelQueue] 处理取消: ${job.data.orderNo}`);
        try {
            const result = await processor(job.data);
            console.log(`[CancelQueue] 取消处理成功: ${job.data.orderNo}`);
            return result;
        } catch (error) {
            console.error(`[CancelQueue] 取消处理失败: ${job.data.orderNo}`, error.message);
            throw error;
        }
    });
}

/**
 * 获取队列状态
 * @returns {Promise<Object>} 队列状态
 */
async function getQueueStatus() {
    const [orderWaiting, orderActive, orderCompleted, orderFailed] = await Promise.all([
        orderQueue.getWaitingCount(),
        orderQueue.getActiveCount(),
        orderQueue.getCompletedCount(),
        orderQueue.getFailedCount(),
    ]);

    const [stockWaiting, stockActive] = await Promise.all([
        stockSyncQueue.getWaitingCount(),
        stockSyncQueue.getActiveCount(),
    ]);

    const [paymentWaiting, paymentActive] = await Promise.all([
        paymentQueue.getWaitingCount(),
        paymentQueue.getActiveCount(),
    ]);

    const [cancelWaiting, cancelActive] = await Promise.all([
        cancelQueue.getWaitingCount(),
        cancelQueue.getActiveCount(),
    ]);

    return {
        order: {
            waiting: orderWaiting,
            active: orderActive,
            completed: orderCompleted,
            failed: orderFailed,
        },
        stock: {
            waiting: stockWaiting,
            active: stockActive,
        },
        payment: {
            waiting: paymentWaiting,
            active: paymentActive,
        },
        cancel: {
            waiting: cancelWaiting,
            active: cancelActive,
        },
    };
}

/**
 * 清空所有队列（慎用）
 */
async function cleanAllQueues() {
    await Promise.all([
        orderQueue.clean(0, 'completed'),
        orderQueue.clean(0, 'failed'),
        orderQueue.clean(0, 'wait'),
        stockSyncQueue.clean(0, 'completed'),
        paymentQueue.clean(0, 'completed'),
        cancelQueue.clean(0, 'completed'),
        cancelQueue.clean(0, 'failed'),
        cancelQueue.clean(0, 'wait'),
    ]);
    console.log('[QueueService] 所有队列已清空');
}

/**
 * 优雅关闭队列
 */
async function closeQueues() {
    await Promise.all([
        orderQueue.close(),
        stockSyncQueue.close(),
        paymentQueue.close(),
        cancelQueue.close(),
    ]);
    console.log('[QueueService] 队列服务已关闭');
}

// 监听队列事件
orderQueue.on('completed', (job) => {
    console.log(`[OrderQueue] 任务完成: ${job.id}`);
});

orderQueue.on('failed', (job, err) => {
    console.error(`[OrderQueue] 任务失败: ${job.id}`, err.message);
});

stockSyncQueue.on('completed', (job) => {
    console.log(`[StockQueue] 任务完成: ${job.id}`);
});

paymentQueue.on('completed', (job) => {
    console.log(`[PaymentQueue] 任务完成: ${job.id}`);
});

cancelQueue.on('completed', (job) => {
    console.log(`[CancelQueue] 任务完成: ${job.id}`);
});

module.exports = {
    // 添加任务
    addOrderJob,
    addStockSyncJob,
    addPaymentJob,
    addCancelJob,

    // 处理任务
    processOrderQueue,
    processStockSyncQueue,
    processPaymentQueue,
    processCancelQueue,

    // 管理
    getQueueStatus,
    cleanAllQueues,
    closeQueues,

    // 队列实例（用于高级操作）
    queues: {
        order: orderQueue,
        stock: stockSyncQueue,
        payment: paymentQueue,
        cancel: cancelQueue,
    },
};
