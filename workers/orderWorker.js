/**
 * 订单处理工作进程
 * 消费消息队列中的订单，批量写入数据库
 * 
 * 启动方式：node workers/orderWorker.js
 * 或使用 pm2: pm2 start workers/orderWorker.js --name order-worker
 */
const queueService = require('../services/queueService');
const redisService = require('../services/redisService');
const { Op } = require('sequelize');
const comboPurchaseService = require('../services/comboPurchaseService');
const hotelPurchaseService = require('../services/hotelPurchaseService');
const { Order, Ticket, PackageOrderDetail, PackageItem, RoomPackage, RoomInventory, PackageDatePrice, HotelOrder, ParkingReservation } = require('../models/Summary');
const { setupAssociations } = require('../models/associations');
const { generateNights } = require('../utils/dateHelper');

/**
 * 处理订单创建
 * 从消息队列消费订单数据，写入数据库
 * 失败时自动回滚库存和购买记录
 */
async function processOrderCreation(orderData) {
    // 提取补偿相关信息
    const { rollbackStock, stockKey, count, purchaseKey, ...orderInfo } = orderData;

    try {
        console.log(`[OrderWorker] 处理订单: ${orderInfo.orderNumber}`);

        // 判断订单类型：套餐订单还是票务订单
        if (orderInfo.packageItemId) {
            // 套餐订单处理
            return await processPackageOrder(orderData);
        } else {
            // 票务订单处理
            return await processTicketOrder(orderData);
        }

    } catch (error) {
        console.error(`[OrderWorker] 订单创建失败: ${orderInfo.orderNumber}`, error.message);

        // 失败时回滚库存和购买记录
        if (rollbackStock) {
            try {
                // 判断订单类型
                if (orderInfo.packageItemId) {
                    // 套餐订单回滚
                    await rollbackPackageStock(orderData);
                } else {
                    // 票务订单回滚
                    console.log(`[OrderWorker] 开始回滚: stockKey=${stockKey}, count=${count}`);

                    // 恢复Redis库存
                    if (stockKey && count) {
                        await redisService.incrFun(stockKey, count);
                        console.log(`[OrderWorker] 库存已恢复: ${stockKey} +${count}`);
                    }

                    // 删除购买记录，允许用户重新购买
                    if (purchaseKey) {
                        await redisService.delFun(purchaseKey);
                        console.log(`[OrderWorker] 购买记录已删除: ${purchaseKey}`);
                    }
                }

                console.log(`[OrderWorker] 回滚完成`);
            } catch (rollbackError) {
                console.error(`[OrderWorker] 回滚失败:`, rollbackError.message);
                // 回滚失败需要人工介入，记录到日志或死信队列
            }
        }

        throw error;
    }
}
/**
 * 处理套餐订单
 * 处理套餐订单，包括创建订单详情、更新库存、记录购买记录等
 * * @param {*} orderData
 */
async function processPackageOrder(orderData) {
    const { rollbackStock, roomTypeId, dateRange, ...orderInfo } = orderData;

    console.log(`[OrderWorker] 处理套餐订单: ${orderInfo.orderNumber}, packageItemId=${orderInfo.packageItemId}`);

    const packageItem = await PackageItem.findOne({
        where: { id: orderInfo.packageItemId },
        include: [
            {
                model: RoomPackage,
                as: 'roomPackage'
            }
        ]
    });

    if (!packageItem) {
        throw new Error(`套餐不存在: ${orderInfo.packageItemId}`);
    }

    const packageOrderDetail = await PackageOrderDetail.create({
        orderNumber: orderInfo.orderNumber,
        title: packageItem.itemName,           // 统一字段名：补 title（套餐项显示名）
        userId: orderInfo.userId,
        userName: orderInfo.userName || '',
        userPhone: orderInfo.userPhone || '',
        buyNum: orderInfo.buyNum,
        orderStatus: orderInfo.orderStatus || 1,
        orderAmount: parseFloat(orderInfo.totalAmount || 0),
        refundAmount: 0,
        packageId: orderInfo.productPackageId,
        groupId: packageItem.groupId,
        isPrimary: packageItem.isPrimary,
        itemType: parseInt(orderInfo.itemType),
        roomPackageId: packageItem.roomPackageId,
        itemName: packageItem.itemName,
        quantity: orderInfo.buyNum,
        unitPrice: parseFloat(orderInfo.unitPrice),
        useDate: orderInfo.startDate,
        useEndDate: orderInfo.endDate,
        verifyCode: orderInfo.orderNumber,
        verifyStatus: 1,
        description: packageItem.description
    });

    await redisService.setFun(
        `order:${orderInfo.orderNumber}`,
        {
            ...orderInfo,
            verifyCode: orderInfo.orderNumber,
            packageOrderDetailId: packageOrderDetail.id,
            isPackageOrder: true
        },
        600
    );

    console.log(`[OrderWorker] 套餐订单创建成功: ${orderInfo.orderNumber}, 核销码: ${orderInfo.orderNumber}`);
    return { success: true, orderId: packageOrderDetail.id };
}



async function processTicketOrder(orderData) {
    const { rollbackStock, stockKey, count, purchaseKey, ...orderInfo } = orderData;

    console.log(`[OrderWorker] 处理票务订单: ${orderInfo.orderNumber}`);

    // 获取商品信息（补充订单数据）
    const ticket = await Ticket.findOne({
        where: { id: orderInfo.goodsId },
        attributes: ['id', 'title', 'ticketType', 'discountPrice']
    });

    if (!ticket) {
        throw new Error(`商品不存在: ${orderInfo.goodsId}`);
    }

    // 补充订单数据
    const completeOrderData = {
        ...orderInfo,
        title: ticket.title,
        ticketType: ticket.ticketType,
        ticketPrice: ticket.discountPrice,
        orderAmount: ticket.discountPrice * orderInfo.buyNum,
        refundAmount: 0,
        seat: orderInfo.seat ? JSON.stringify(orderInfo.seat) : '0',
        playDate: new Date().toISOString().split('T')[0],
    };

    // 创建订单
    const order = await Order.create(completeOrderData);

    // 缓存订单信息到Redis（10分钟）
    await redisService.setFun(
        `order:${orderInfo.orderNumber}`,
        completeOrderData,
        600
    );

    console.log(`[OrderWorker] 票务订单创建成功: ${orderInfo.orderNumber}`);
    return { success: true, orderId: order.id };
}

function generateVerifyCode() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${random}`.toUpperCase();
}

async function rollbackPackageStock(orderData) {
    const { packageItemId, roomTypeId, buyNum, dateRange } = orderData;

    console.log(`[OrderWorker] 开始回滚套餐库存: packageItemId=${packageItemId}, roomTypeId=${roomTypeId}, buyNum=${buyNum}`);

    try {
        // 回滚每天的库存
        for (const date of dateRange) {
            const stockKeys = [
                `combo:stock:${packageItemId}:${date}`,
                `hotel:roomtype:stock:${roomTypeId}:${date}`
            ];

            await comboPurchaseService.refundStock(stockKeys, buyNum);
            console.log(`[OrderWorker] 已回滚 ${date} 的库存: ${buyNum}`);
        }

        // 同步回滚 DB 库存（soldStock 减少，availableStock 恢复）
        await syncPackageStockToDB(packageItemId, roomTypeId, dateRange, buyNum, false);

        console.log(`[OrderWorker] 套餐库存回滚完成`);
    } catch (error) {
        console.error(`[OrderWorker] 套餐库存回滚失败:`, error.message);
        throw error;
    }
}

/**
 * 同步套餐/酒店库存到数据库
 * 支付成功时 isIncrement=true（soldStock 增加，availableStock 减少）
 * 取消/回滚时 isIncrement=false（soldStock 减少，availableStock 恢复）
 * Redis 是运行时权威，DB 同步为最终一致，失败仅记录日志不影响主流程
 */
async function syncPackageStockToDB(packageItemId, roomTypeId, dateRange, buyNum, isIncrement) {
    try {
        for (const date of dateRange) {
            // 套餐当日限量（PackageDatePrice）
            const pkgDatePrice = await PackageDatePrice.findOne({
                where: { packageItemId, date }
            });
            if (pkgDatePrice) {
                if (isIncrement) {
                    await pkgDatePrice.increment('soldStock', { by: buyNum });
                    await pkgDatePrice.decrement('availableStock', { by: buyNum });
                } else {
                    await pkgDatePrice.decrement('soldStock', { by: buyNum });
                    await pkgDatePrice.increment('availableStock', { by: buyNum });
                }
            }

            // 房型共享库存（RoomInventory）
            if (roomTypeId) {
                const inventory = await RoomInventory.findOne({
                    where: { roomTypeId, date }
                });
                if (inventory) {
                    if (isIncrement) {
                        await inventory.increment('soldStock', { by: buyNum });
                        await inventory.decrement('availableStock', { by: buyNum });
                    } else {
                        await inventory.decrement('soldStock', { by: buyNum });
                        await inventory.increment('availableStock', { by: buyNum });
                    }
                }
            }
        }
        console.log(`[StockSync] DB 库存同步完成: packageItemId=${packageItemId}, roomTypeId=${roomTypeId}, buyNum=${buyNum}, isIncrement=${isIncrement}`);
    } catch (error) {
        // DB 同步失败不影响主流程（Redis 已是权威），仅记录日志
        console.error(`[StockSync] DB 库存同步失败:`, error.message);
    }
}

// generateNights 已抽取到 utils/dateHelper.js → generateNights（不含退房日语义）

/**
 * 同步酒店房型库存到数据库（RoomInventory）
 * 支付成功 isIncrement=true（soldStock 增加，availableStock 减少）
 * 取消/回滚 isIncrement=false（soldStock 减少，availableStock 恢复）
 * Redis 是运行时权威，DB 同步为最终一致，失败仅记录日志
 */
async function syncHotelStockToDB(roomTypeId, nights, count, isIncrement) {
    try {
        for (const date of nights) {
            const inventory = await RoomInventory.findOne({
                where: { roomTypeId, date }
            });
            if (inventory) {
                if (isIncrement) {
                    await inventory.increment('soldStock', { by: count });
                    await inventory.decrement('availableStock', { by: count });
                } else {
                    await inventory.decrement('soldStock', { by: count });
                    await inventory.increment('availableStock', { by: count });
                }
            }
        }
        console.log(`[StockSync] 酒店DB库存同步完成: roomTypeId=${roomTypeId}, count=${count}, isIncrement=${isIncrement}`);
    } catch (error) {
        console.error(`[StockSync] 酒店DB库存同步失败:`, error.message);
    }
}

/**
 * 处理库存同步
 * 同步Redis库存变动到数据库
 * 扣减remainingStock（剩余库存），增加soldCount（已售数量）
 */
async function processStockSync(stockData) {
    const { goodsId, count, operation, orderNo } = stockData;

    try {
        console.log(`[StockWorker] 同步库存: goodsId=${goodsId}, count=${count}, operation=${operation}`);

        const ticket = await Ticket.findOne({ where: { id: goodsId } });

        if (!ticket) {
            throw new Error(`商品不存在: ${goodsId}`);
        }

        if (operation === 'decrease') {
            // 扣减剩余库存，增加已售数量
            await ticket.decrement('remainingStock', { by: count });
            await ticket.increment('soldCount', { by: count });
            console.log(`[StockWorker] 剩余库存已扣减: ${goodsId} - ${count}, 已售数量: +${count}`);
        } else if (operation === 'increase') {
            // 恢复剩余库存，减少已售数量（取消订单时）
            await ticket.increment('remainingStock', { by: count });
            await ticket.decrement('soldCount', { by: count });
            console.log(`[StockWorker] 剩余库存已恢复: ${goodsId} + ${count}, 已售数量: -${count}`);
        }

        return { success: true };

    } catch (error) {
        console.error(`[StockWorker] 库存同步失败: ${goodsId}`, error.message);
        throw error;
    }
}

/**
 * 处理支付回调
 */
async function processPaymentCallback(paymentData) {
    console.log(`[PaymentWorker] 处理支付回调`, paymentData.gmt_payment)
    console.log(`[PaymentWorker] 处理支付回调`, paymentData)
    const { out_trade_no, trade_status, total_amount, notifyData } = paymentData;

    try {
        console.log(`[PaymentWorker] 处理支付: ${out_trade_no}, 状态: ${trade_status}`);

        let order = await Order.findOne({
            where: { orderNumber: out_trade_no }
        });

        let isPackageOrder = false;
        let isHotelOrder = false;
        let isParkingOrder = false;
        if (!order) {
            order = await PackageOrderDetail.findOne({
                where: { orderNumber: out_trade_no }
            });
            isPackageOrder = !!order;
        }
        if (!order) {
            order = await HotelOrder.findOne({
                where: { orderNumber: out_trade_no }
            });
            isHotelOrder = !!order;
        }
        // 停车预约订单
        if (!order) {
            order = await ParkingReservation.findOne({
                where: { orderNumber: out_trade_no }
            });
            isParkingOrder = !!order;
        }

        if (!order) {
            throw new Error(`订单不存在: ${out_trade_no}`);
        }

        if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
            // 停车预约用 payStatus===1 判断未支付，其他业务用 orderStatus/status
            const currentStatus = isParkingOrder
                ? order.payStatus
                : isHotelOrder ? order.status : order.orderStatus;
            if (currentStatus === 1) {
                if (isParkingOrder) {
                    // 条件更新保证幂等：已支付的不重复处理
                    const [updated] = await ParkingReservation.update({
                        payStatus: 2, // 已支付
                        status: 1, // 已确认
                        tradeNo: notifyData.trade_no,
                        paymentTime: notifyData.gmt_payment,
                    }, { where: { orderNumber: out_trade_no, payStatus: 1 } });
                    if (updated > 0) {
                        // 清除支付超时标记
                        await redisService.delFun(`parking:pay:expire:${out_trade_no}`).catch(() => { });
                        console.log(`[PaymentWorker] 停车预约支付成功: ${out_trade_no}, 支付宝交易号: ${notifyData.trade_no}, 支付时间: ${notifyData.gmt_payment}`);
                    }
                } else if (isHotelOrder) {
                    await HotelOrder.update({
                        status: 2,
                        verifyStatus: 1,
                        alipayTradeNo: notifyData.trade_no,
                        paymentTime: notifyData.gmt_payment,
                    }, { where: { orderNumber: out_trade_no } });
                    // 同步 DB 房型库存（soldStock 增加，availableStock 减少）
                    const nights = generateNights(order.checkInDate, order.checkOutDate);
                    await syncHotelStockToDB(order.roomTypeId, nights, order.roomCount, true);
                    console.log(`[PaymentWorker] 酒店订单支付成功: ${out_trade_no}, 支付时间: ${notifyData.gmt_payment}`);
                } else if (isPackageOrder) {
                    await PackageOrderDetail.update({
                        orderStatus: 2,
                        orderAmount: total_amount,
                        alipayTradeNo: notifyData.trade_no,
                        paymentTime: notifyData.gmt_payment,
                    }, { where: { orderNumber: out_trade_no } });

                    // 同步 DB 库存（soldStock 增加，availableStock 减少）
                    // 优先从 Redis 缓存读取完整订单信息（含 packageItemId/roomTypeId/dateRange）
                    const cachedOrder = await redisService.getFun(`order:${out_trade_no}`, false);
                    if (cachedOrder && cachedOrder.packageItemId && cachedOrder.dateRange) {
                        await syncPackageStockToDB(
                            cachedOrder.packageItemId,
                            cachedOrder.roomTypeId,
                            cachedOrder.dateRange,
                            cachedOrder.buyNum,
                            true
                        );
                    } else {
                        // 缓存过期，从 DB 推导：roomPackageId → roomTypeId，useDate/useEndDate → dateRange
                        try {
                            const roomPkg = await RoomPackage.findOne({ where: { id: order.roomPackageId } });
                            const roomTypeId = roomPkg ? roomPkg.roomTypeId : null;
                            const { eachDayOfInterval, parseISO } = require('date-fns');
                            const dateRange = eachDayOfInterval({
                                start: parseISO(order.useDate),
                                end: parseISO(order.useEndDate)
                            }).map(d => require('date-fns').format(d, 'yyyy-MM-dd'));
                            // packageItemId 缺失时仅同步房型库存
                            if (roomTypeId) {
                                await syncPackageStockToDB(null, roomTypeId, dateRange, order.quantity, true);
                            }
                        } catch (e) {
                            console.error(`[StockSync] 支付成功 DB 库存同步失败(降级): ${out_trade_no}`, e.message);
                        }
                    }
                } else {
                    await Order.update({
                        orderStatus: 2,
                        orderAmount: total_amount,
                        alipayTradeNo: notifyData.trade_no,
                        paymentTime: notifyData.gmt_payment,
                    }, { where: { orderNumber: out_trade_no } });
                }

                console.log(`[PaymentWorker] 订单支付成功: ${out_trade_no}, 支付宝交易号: ${notifyData.trade_no}, 支付时间: ${notifyData.gmt_payment}`);
            }

        } else if (trade_status === 'TRADE_CLOSED') {
            // 停车预约：未支付交易关闭 → 取消预约单，释放车位时段
            if (isParkingOrder && order.payStatus === 1) {
                const [updated] = await ParkingReservation.update({
                    status: 2,
                    cancelReason: '支付宝交易关闭',
                }, { where: { orderNumber: out_trade_no, payStatus: 1, status: { [Op.ne]: 2 } } });
                if (updated > 0) {
                    await redisService.delFun(`parking:pay:expire:${out_trade_no}`).catch(() => { });
                    console.log(`[PaymentWorker] 停车预约交易关闭，已取消并释放车位时段: ${out_trade_no}`);
                }
                return { success: true };
            }
            const currentStatus = isHotelOrder ? order.status : order.orderStatus;
            if (currentStatus === 1) {
                if (isHotelOrder) {
                    const nights = generateNights(order.checkInDate, order.checkOutDate);
                    // 恢复 Redis 房型库存（Lua 原子恢复）
                    await hotelPurchaseService.refundHotel({
                        roomPackageId: order.roomId,
                        roomTypeId: order.roomTypeId,
                        quantity: order.roomCount,
                        checkIn: order.checkInDate,
                        checkOut: order.checkOutDate
                    });
                    // 同步回滚 DB 房型库存
                    await syncHotelStockToDB(order.roomTypeId, nights, order.roomCount, false);
                    await HotelOrder.update({ status: 5 }, { where: { orderNumber: out_trade_no } });
                    console.log(`[PaymentWorker] 酒店订单已关闭，库存已恢复: ${out_trade_no}`);
                } else if (isPackageOrder) {
                    const cancelData = await redisService.getFun(`cancel:data:${out_trade_no}`, false);
                    if (cancelData && cancelData.packageItemId && cancelData.roomTypeId && cancelData.dateRange) {
                        for (const date of cancelData.dateRange) {
                            const stockKeys = [
                                `combo:stock:${cancelData.packageItemId}:${date}`,
                                `hotel:roomtype:stock:${cancelData.roomTypeId}:${date}`
                            ];
                            await comboPurchaseService.refundStock(stockKeys, cancelData.count);
                        }
                        // 同步回滚 DB 库存
                        await syncPackageStockToDB(cancelData.packageItemId, cancelData.roomTypeId, cancelData.dateRange, cancelData.count, false);
                    }

                    await PackageOrderDetail.update({
                        orderStatus: 3,
                        verifyStatus: 3,
                    }, { where: { orderNumber: out_trade_no } });
                } else {
                    await redisService.incrFun(
                        `ticket:stock:${order.goodsId}`,
                        order.buyNum
                    );

                    const ticket = await Ticket.findOne({ where: { id: order.goodsId } });
                    if (ticket) {
                        await ticket.increment('stock', { by: order.buyNum });
                    }

                    const orderPurchaseKey = `purchase:${order.memberId}:${order.goodsId}:${out_trade_no}`;
                    await redisService.delFun(orderPurchaseKey);
                    console.log(`[PaymentWorker] 购买记录已删除: ${orderPurchaseKey}`);

                    await Order.update({
                        orderStatus: 5,
                        verifyStatus: 3,
                    }, { where: { orderNumber: out_trade_no } });
                }

                console.log(`[PaymentWorker] 订单已取消，库存已恢复: ${out_trade_no}`);
            }
        }

        return { success: true };

    } catch (error) {
        console.error(`[PaymentWorker] 支付处理失败: ${out_trade_no}`, error.message);
        throw error;
    }
}

/**
 * 处理订单取消（超时未支付）
 * 处理订单取消（超时未支付）
 * 根据订单类型（酒店/套餐/票务）执行相应的库存恢复和状态更新操作
 * @param {Object} cancelData - 取消订单数据
 * @param {string} cancelData.orderNo - 订单编号
 * @param {number} cancelData.goodsId - 商品ID（票务订单使用）
 * @param {number} cancelData.userId - 用户ID
 * @param {number} cancelData.count - 取消数量
 * @param {string} cancelData.reason - 取消原因
 * @param {number} [cancelData.packageItemId] - 套餐项ID（套餐订单使用）
 * @param {number} [cancelData.roomTypeId] - 房型ID（酒店/套餐订单使用）
 * @param {string[]} [cancelData.dateRange] - 日期范围（套餐订单使用）
 * @returns {Promise<{success: boolean, message?: string}>} 取消结果
 */
async function processOrderCancel(cancelData) {
    const { orderNo, goodsId, userId, count, reason, packageItemId, roomTypeId, dateRange } = cancelData;

    try {
        console.log(`[CancelWorker] 处理取消: ${orderNo}, 原因: ${reason}`);

        let order = await Order.findOne({
            where: { orderNumber: orderNo }
        });

        let isPackageOrder = false;
        let isHotelOrder = false;
        if (!order) {
            order = await PackageOrderDetail.findOne({
                where: { orderNumber: orderNo }
            });
            isPackageOrder = !!order;
        }
        if (!order) {
            order = await HotelOrder.findOne({
                where: { orderNumber: orderNo }
            });
            isHotelOrder = !!order;
        }

        if (!order) {
            console.log(`[CancelWorker] 订单不存在: ${orderNo}`);
            return { success: true, message: '订单不存在' };
        }

        const currentStatus = isHotelOrder ? order.status : order.orderStatus;
        if (currentStatus !== 1) {
            console.log(`[CancelWorker] 订单${orderNo}状态为${currentStatus}，无需取消`);
            return { success: true, message: '订单已处理，无需取消' };
        }

        if (isHotelOrder) {
            console.log(`[CancelWorker] 酒店订单取消，恢复库存: roomTypeId=${order.roomTypeId}, count=${order.roomCount}`);
            const cancelNights = generateNights(order.checkInDate, order.checkOutDate);
            // 恢复 Redis 房型库存（Lua 原子恢复）
            await hotelPurchaseService.refundHotel({
                roomPackageId: order.roomId,
                roomTypeId: order.roomTypeId,
                quantity: order.roomCount,
                checkIn: order.checkInDate,
                checkOut: order.checkOutDate
            });
            // 同步回滚 DB 房型库存
            await syncHotelStockToDB(order.roomTypeId, cancelNights, order.roomCount, false);
            await HotelOrder.update({ status: 3 }, { where: { orderNumber: orderNo } });
        } else if (isPackageOrder) {
            console.log(`[CancelWorker] 套餐订单取消，恢复库存: packageItemId=${packageItemId}, roomTypeId=${roomTypeId}`);
            for (const date of dateRange) {
                const stockKeys = [
                    `combo:stock:${packageItemId}:${date}`,
                    `hotel:roomtype:stock:${roomTypeId}:${date}`
                ];
                await comboPurchaseService.refundStock(stockKeys, count);
                console.log(`[CancelWorker] 已恢复 ${date} 的库存: +${count}`);
            }

            // 同步回滚 DB 库存（soldStock 减少，availableStock 恢复）
            await syncPackageStockToDB(packageItemId, roomTypeId, dateRange, count, false);

            await PackageOrderDetail.update({
                orderStatus: 3,
                verifyStatus: 3,
            }, { where: { orderNumber: orderNo } });
        } else {
            await redisService.incrFun(`ticket:stock:${goodsId}`, count);
            console.log(`[CancelWorker] Redis库存已恢复: ${goodsId} +${count}`);

            const ticket = await Ticket.findOne({ where: { id: goodsId } });
            if (ticket) {
                await ticket.increment('remainingStock', { by: count });
                await ticket.decrement('soldCount', { by: count });
                console.log(`[CancelWorker] 数据库库存已恢复`);
            }

            const orderPurchaseKey = `purchase:${userId}:${goodsId}:${orderNo}`;
            await redisService.delFun(orderPurchaseKey);
            console.log(`[CancelWorker] 购买记录已删除: ${orderPurchaseKey}`);

            await Order.update({
                orderStatus: 3,
                verifyStatus: 3,
                cancelReason: reason,
                cancelTime: new Date()
            }, { where: { orderNumber: orderNo } });
        }

        console.log(`[CancelWorker] 订单已取消: ${orderNo}`);
        return { success: true };

    } catch (error) {
        console.error(`[CancelWorker] 取消订单失败: ${orderNo}`, error.message);
        throw error;
    }
}

/**
 * 启动工作进程
 */
function startWorker() {
    setupAssociations();
    console.log('[Worker] 订单处理工作进程已启动');

    // 注册订单处理器
    queueService.processOrderQueue(processOrderCreation);

    // 注册库存同步处理器
    queueService.processStockSyncQueue(processStockSync);

    // 注册支付回调处理器
    queueService.processPaymentQueue(processPaymentCallback);

    // 注册订单取消处理器
    queueService.processCancelQueue(processOrderCancel);

    console.log('[Worker] 所有处理器已注册');
}

/**
 * 优雅关闭
 */
async function gracefulShutdown() {
    console.log('[Worker] 正在关闭工作进程...');
    await queueService.closeQueues();
    console.log('[Worker] 工作进程已关闭');
    process.exit(0);
}

// 监听进程信号
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 启动工作进程
startWorker();

// 导出供测试使用
module.exports = {
    processOrderCreation,
    processStockSync,
    processPaymentCallback,
    processOrderCancel,
};
