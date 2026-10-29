/**
 * 全业务订单状态定时任务
 *
 * 一、超时未支付自动取消（下单即占资源，用户不支付时支付宝不会推送任何回调，
 *     订单会永远停在待支付、库存被锁死。本任务定时扫 DB 对账兜底）：
 *
 *   票务 Order               payStatus=1 → 调 seckillPayment.handleOrderCancel
 *                                       （含 Redis 票库存回补 + 座位释放补偿）
 *   套餐 PackageOrderDetail  payStatus=1 → 置 payStatus=5 + Redis 库存恢复
 *                                       （cancel:data 从未写入，从 DB 推导恢复）
 *   酒店 HotelOrder          payStatus=1 → 置 payStatus=5 + refundHotel 恢复 Redis 房型库存
 *                                       （DB 库存支付成功才会 sync，无需回补）
 *   夏令 campOrders          payStatus=1 → 置 payStatus=5 + 回补 CampSession.soldCount
 *   停车 ParkingReservation  payStatus=1 → 置 payStatus=5 取消；
 *                           时段结束仍未支付 → 兜底取消
 *                           （已支付订单支付成功即为 3已完成，时段结束无需再作废）
 *
 * 二、已支付订单超过使用期未核销 → 履约状态置为已过期（verifyStatus=3）：
 *   票务 playDate / 套餐 useEndDate / 酒店 checkOutDate / 公交车票 rideDate 过期；
 *   夏令营结营（endDate 过）→ payStatus 2已支付 → 3已完成
 *
 * 幂等性：所有更新都带"当前仍为待支付/待核销状态"的条件，重复扫描/并发不会误改。
 *
 * 启动：由 app.js 的 initializeCronJobs() 注册，随主进程运行（每30秒扫描一次）
 */
const cron = require("node-cron");
const { Op } = require("sequelize");
const {
    Order,
    PackageOrderDetail,
    HotelOrder,
    campOrders,
    CampSession,
    RoomPackage,
    PackageItem,
    ParkingReservation,
    ScenicBusOrder,
    ScenicBusOrderTicket,
} = require("../models/Summary");
const redisService = require("../services/redisService");
const hotelPurchaseService = require("../services/hotelPurchaseService");
const comboPurchaseService = require("../services/comboPurchaseService");
const seckillPayment = require("../routes/managementSystem/payment/seckillPayment");
const {
    syncOrderStatusAfterTicketChange,
} = require("../routes/managementSystem/appointmentRouter/scenicBus");

// 支付超时时长（分钟），与各业务支付窗口（expireSeconds: 600）一致
const PAY_EXPIRE_MINUTES = 10;

/**
 * 票务订单：复用 seckillPayment.handleOrderCancel
 * （该函数此前定义了但无任何调用方——本任务补上了调用）
 * 内部含事务 + 状态校验（payStatus!==1 拒绝），天然幂等
 */
async function cancelExpiredTicketOrders(expireTime) {
    const expired = await Order.findAll({
        where: { payStatus: 1, createdAt: { [Op.lt]: expireTime } },
        attributes: ["orderNumber"],
        limit: 100,
    });

    for (const item of expired) {
        try {
            const result = await seckillPayment.handleOrderCancel(
                item.orderNumber,
                "超时未支付自动取消"
            );
            if (result && result.success) {
                console.log(`[OrderExpire] 票务订单已取消并回补库存: ${item.orderNumber}`);
            }
        } catch (error) {
            console.error(`[OrderExpire] 票务订单取消失败: ${item.orderNumber}`, error.message);
        }
    }
}

/**
 * 套餐订单：置 payStatus=5（已取消）+ 恢复 Redis 库存
 *
 * 库存恢复说明：设计上依赖下单时写入的 Redis cancel:data 上下文，
 * 但该 key 从未被写入过，只能从 DB 订单字段推导：
 *   roomPackageId → RoomPackage.roomTypeId（房型库存 key）
 *   roomPackageId → PackageItem.id（套餐库存 key，一个套餐对应多个
 *   packageItem 时仅能恢复查到的第一个，尽力恢复）
 *   useDate ~ useEndDate → dateRange
 * DB 的 PackageDatePrice/RoomInventory 只在支付成功后才 sync，未支付无需回补。
 */
async function cancelExpiredPackageOrders(expireTime) {
    const expired = await PackageOrderDetail.findAll({
        where: { payStatus: 1, createdAt: { [Op.lt]: expireTime } },
        limit: 100,
    });

    for (const order of expired) {
        try {
            // 条件更新保证幂等：只在仍为待支付时取消
            const [updated] = await PackageOrderDetail.update(
                { payStatus: 5, cancelReason: "超时未支付自动取消" },
                { where: { orderNumber: order.orderNumber, payStatus: 1 } }
            );
            if (updated === 0) continue;

            await restorePackageRedisStock(order);
            console.log(`[OrderExpire] 套餐订单已取消并恢复库存: ${order.orderNumber}`);
        } catch (error) {
            console.error(
                `[OrderExpire] 套餐订单取消失败: ${order.orderNumber}`,
                error.message
            );
        }
    }
}

// 从 DB 推导并恢复套餐占用的 Redis 库存
async function restorePackageRedisStock(order) {
    try {
        const roomPkg = await RoomPackage.findOne({ where: { id: order.roomPackageId } });
        const roomTypeId = roomPkg ? roomPkg.roomTypeId : null;

        const pkgItem = await PackageItem.findOne({
            where: { roomPackageId: order.roomPackageId },
        });
        if (!pkgItem && !roomTypeId) return; // 无可恢复的库存维度

        const { eachDayOfInterval, parseISO, format } = require("date-fns");
        const dateRange = eachDayOfInterval({
            start: parseISO(order.useDate),
            end: parseISO(order.useEndDate),
        }).map((d) => format(d, "yyyy-MM-dd"));

        for (const date of dateRange) {
            const stockKeys = [];
            if (pkgItem) stockKeys.push(`combo:stock:${pkgItem.id}:${date}`);
            if (roomTypeId) stockKeys.push(`hotel:roomtype:stock:${roomTypeId}:${date}`);
            await comboPurchaseService.refundStock(stockKeys, order.quantity);
        }
    } catch (error) {
        // 库存恢复失败不回滚取消状态（订单状态与库存短暂不一致时人工介入），仅记录
        console.error(
            `[OrderExpire] 套餐 Redis 库存恢复失败（需人工核对）: ${order.orderNumber}`,
            error.message
        );
    }
}

/**
 * 酒店订单：置 payStatus=5（已取消）+ 恢复 Redis 房型库存
 * DB 的 RoomInventory 只在支付成功后才 sync，未支付无需回补
 */
async function cancelExpiredHotelOrders(expireTime) {
    const expired = await HotelOrder.findAll({
        where: { payStatus: 1, createdAt: { [Op.lt]: expireTime } },
        limit: 100,
    });

    for (const order of expired) {
        try {
            const [updated] = await HotelOrder.update(
                { payStatus: 5, cancelReason: "超时未支付自动取消" },
                { where: { id: order.id, payStatus: 1 } }
            );
            if (updated === 0) continue;

            // 恢复 Redis 房型库存（按入住区间）
            await hotelPurchaseService
                .refundHotel({
                    roomPackageId: order.roomId,
                    roomTypeId: order.roomTypeId,
                    quantity: order.roomCount,
                    checkIn: order.checkInDate,
                    checkOut: order.checkOutDate,
                })
                .catch((error) => {
                    console.error(
                        `[OrderExpire] 酒店 Redis 库存恢复失败（需人工核对）: ${order.orderNumber}`,
                        error.message
                    );
                });

            console.log(`[OrderExpire] 酒店订单已取消并恢复库存: ${order.orderNumber}`);
        } catch (error) {
            console.error(
                `[OrderExpire] 酒店订单取消失败: ${order.orderNumber}`,
                error.message
            );
        }
    }
}

/**
 * 夏令订单：置 payStatus=5（已取消）+ 回补 CampSession.soldCount
 * （下单时按报名人数 soldCount+peopleCount，此处做逆操作）
 */
async function cancelExpiredCampOrders(expireTime) {
    const expired = await campOrders.findAll({
        where: {
            payStatus: 1,
            createdAt: { [Op.lt]: expireTime },
        },
        limit: 100,
    });

    for (const order of expired) {
        try {
            const [updated] = await campOrders.update(
                { payStatus: 5, cancelReason: "超时未支付自动取消" },
                { where: { id: order.id, payStatus: 1 } }
            );
            if (updated === 0) continue;

            // 回补场次库存（按订单报名人数，DB 原子操作）
            await CampSession.decrement("soldCount", {
                by: order.peopleCount || 1,
                where: { id: order.sessionId },
            });

            console.log(`[OrderExpire] 夏令订单已取消并回补库存: ${order.orderNumber}`);
        } catch (error) {
            console.error(
                `[OrderExpire] 夏令订单取消失败: ${order.orderNumber}`,
                error.message
            );
        }
    }
}

/**
 * 扫描并取消超时未支付的停车预约
 * 条件更新（where 带 payStatus=1）保证幂等，无需加锁
 */
async function cancelExpiredParkingReservations() {
    try {
        const expireTime = new Date(Date.now() - PAY_EXPIRE_MINUTES * 60 * 1000);
        const expired = await ParkingReservation.findAll({
            where: {
                payStatus: 1,
                createdAt: { [Op.lt]: expireTime },
            },
            attributes: ["orderNumber"],
            limit: 100,
        });

        if (expired.length === 0) return;

        console.log(`[ParkingExpire] 发现 ${expired.length} 笔超时未支付停车预约`);

        for (const item of expired) {
            try {
                const [updated] = await ParkingReservation.update(
                    { payStatus: 5, cancelReason: "超时未支付自动取消" },
                    { where: { orderNumber: item.orderNumber, payStatus: 1 } }
                );
                if (updated > 0) {
                    await redisService
                        .delFun(`parking:pay:expire:${item.orderNumber}`)
                        .catch(() => { });
                    console.log(`[ParkingExpire] 已取消并释放车位时段: ${item.orderNumber}`);
                }
            } catch (error) {
                console.error(`[ParkingExpire] 取消失败: ${item.orderNumber}`, error.message);
            }
        }
    } catch (error) {
        console.error("[ParkingExpire] 扫描失败:", error.message);
    }
}

/**
 * 扫描预约时段已结束但仍未支付的停车预约（预约时长固定为1小时）
 *
 * 业务语义：停车订单支付成功即为 3已完成（下单即核销），时段结束无需再作废；
 * 未支付的单时段结束直接取消（理论上已被支付超时任务处理，此处兜底）
 *
 * 条件更新（where 带 payStatus）保证幂等；
 * 取消后不再参与时段重叠判断，车位时段自动释放
 */
async function expireEndedParkingReservations() {
    try {
        const now = new Date();

        // 未支付且时段结束 → 取消（兜底，正常应已被10分钟支付超时任务取消）
        const [cancelled] = await ParkingReservation.update(
            { payStatus: 5, cancelReason: "预约时段结束未支付，自动取消" },
            { where: { payStatus: 1, endTime: { [Op.lt]: now } } }
        );

        if (cancelled > 0)
            console.log(`[ParkingExpire] 已取消 ${cancelled} 笔时段结束未支付的停车预约`);
    } catch (error) {
        console.error("[ParkingExpire] 时段结束扫描失败:", error.message);
    }
}

/**
 * 已支付订单超过使用期未核销 → 履约状态置为已过期（verifyStatus=3）
 *
 * 判定依据（各业务使用期字段）：
 *   票务 Order.playDate（字符串日期）、套餐 PackageOrderDetail.useEndDate、
 *   酒店 HotelOrder.checkOutDate、公交车票 ScenicBusOrderTicket.rideDate；
 *   夏令营结营（endDate 过后）payStatus 2已支付 → 3已完成
 * 停车订单支付成功即为已完成，无需过期处理
 */
async function markExpiredVerifyStatus() {
    try {
        const todayStr = new Date().toISOString().split("T")[0];
        const todayStart = new Date(`${todayStr}T00:00:00`);

        // 票务：游玩日期已过仍未核销
        const [tickets] = await Order.update(
            { verifyStatus: 3 },
            { where: { payStatus: 2, verifyStatus: 1, playDate: { [Op.lt]: todayStr } } }
        );

        // 套餐：使用结束日期已过仍未核销
        const [packages] = await PackageOrderDetail.update(
            { verifyStatus: 3 },
            { where: { payStatus: 2, verifyStatus: 1, useEndDate: { [Op.lt]: todayStart } } }
        );

        // 酒店：离店日期已过仍未核销
        const [hotels] = await HotelOrder.update(
            { verifyStatus: 3 },
            { where: { payStatus: 2, verifyStatus: 1, checkOutDate: { [Op.lt]: todayStart } } }
        );

        // 景区公交：乘车日期已过的待乘车票 → 已过期，并同步订单状态
        // const expiredBusTickets = await ScenicBusOrderTicket.findAll({
        //     where: { verifyStatus: 1, rideDate: { [Op.lt]: todayStr } },
        //     attributes: ["orderId"],
        //     group: ["orderId"],
        //     limit: 100,
        // });

        const expiredBusTickets = await ScenicBusOrderTicket.findAll({
            include: [{
                model: ScenicBusOrder,
                as: 'order', // 👈 注意这里！填你模型关联时定义的 as 别名（如果没有别名可以删掉这行）
                where: { rideDate: { [Op.lt]: todayStr } }, // 👈 条件写在这里（主表）
                attributes: [] // 不需要返回主表的字段
            }],
            where: { verifyStatus: 1 }, // 👈 子表自己的条件
            attributes: ["orderId"],
            group: ["orderId"],
            limit: 100,
        });
        let busOrders = 0;
        for (const item of expiredBusTickets) {
            const [updated] = await ScenicBusOrderTicket.update(
                { verifyStatus: 3 },
                {
                    where: {
                        orderId: item.orderId,
                        verifyStatus: 1,
                        rideDate: { [Op.lt]: todayStr },
                    },
                }
            );
            if (updated > 0) {
                busOrders++;
                const order = await ScenicBusOrder.findByPk(item.orderId);
                if (order) {
                    // 无剩余待乘车票 → 订单流转为 3已完成 / 4已退款
                    await syncOrderStatusAfterTicketChange(order, null);
                }
            }
        }

        // 夏令营：结营日期已过 → 已完成
        const [camps] = await campOrders.update(
            { payStatus: 3 },
            { where: { payStatus: 2, endDate: { [Op.lt]: todayStart } } }
        );

        if (tickets || packages || hotels || busOrders || camps) {
            console.log(
                `[VerifyExpire] 已过期标记完成: 票务${tickets} 套餐${packages} 酒店${hotels} 公交${busOrders} 夏令${camps}`
            );
        }
    } catch (error) {
        console.error("[VerifyExpire] 已支付未核销过期扫描失败:", error.message);
    }
}

// 统一入口：扫描所有业务的超时未支付订单 + 已支付超期未核销标记
async function cancelExpiredOrders() {
    try {
        const expireTime = new Date(Date.now() - PAY_EXPIRE_MINUTES * 60 * 1000);

        await cancelExpiredTicketOrders(expireTime);
        await cancelExpiredPackageOrders(expireTime);
        await cancelExpiredHotelOrders(expireTime);
        await cancelExpiredCampOrders(expireTime);
        await cancelExpiredParkingReservations();
        await expireEndedParkingReservations();
        await markExpiredVerifyStatus();
    } catch (error) {
        console.error("[OrderExpire] 扫描失败:", error.message);
    }
}

function start() {
    // 每30秒扫描一次
    cron.schedule("*/30 * * * * *", async () => {
        await cancelExpiredOrders();
    });
    console.log(
        "[OrderExpire] 全业务订单状态定时任务已启动（每30秒扫描：超时取消 + 超期未核销标记）"
    );
}

module.exports = {
    start,
    cancelExpiredOrders,
};
