/**
 * seed 脚本：插入一批覆盖全部状态的测试订单数据
 * 用法：node migrations/seed-test-orders.js
 *
 * 前置条件：已执行 node migrations/run-unify-order-pay-status.js
 *          （订单表结构已统一为 payStatus 五态 + verifyStatus 三态）
 *
 * 数据设计（共 33 单 + 7 张公交票 + 2 条退款单）：
 *   票务 orders            7 单：1待支付 / 2已支付待核销 / 2已支付已过期(verify=3) /
 *                              3已完成(verify=2) / 4已退款全额 / 4已退款部分 / 5已取消
 *   套餐 package_order_details 6 单：同上五态 + verify 三态
 *   酒店 hotel_order        6 单：同上五态 + verify 三态
 *   公交 scenicbusorder     5 单 + 10 票：1待支付(无票) / 2已支付部分核销(3票混合状态) /
 *                              3已完成(票全核销) / 4已退款(票全退) / 5已取消
 *   夏令营 campOrders       5 单：1 / 2已支付 / 3已完成(结营) / 4已退款 / 5已取消
 *   停车 parking_reservation 4 单：1待支付 / 3已完成(支付即核销) / 4已退款 / 5已取消
 *   退款单 refund_orders    2 条：指向 seed 票务退款订单（该表 orderNo 有 FK 约束只能指向 orders）
 *
 * 幂等：所有测试数据 orderNumber / refundNo / ticketNo 均带 SEED- 前缀，
 *      重跑前先删除旧的 SEED 数据再插入，不影响库里的真实业务数据。
 *
 * 外键说明（真实库存在 FK 约束，商品 ID 取真实记录）：
 *   orders.memberId → members、scenicbusorder.scenicBusId → scenicbuses、
 *   camporders.ticketId → ticket_type、parking_reservation.parkingId → parkings、
 *   package_order_details.roomPackageId → room_packages、
 *   scenicbusorderticket.orderId → scenicbusorder、refund_orders.orderNo → orders
 *
 * 注意：待支付订单 createdAt 为当前时间；orderExpireTask 定时任务开启后，
 *      超过 10 分钟未支付的 SEED 待支付单会被自动取消（可用来验证定时任务流程）。
 */
const { Op } = require('sequelize');
const { sequelize } = require('../mysql/index');
const {
  Order, PackageOrderDetail, HotelOrder, campOrders, ParkingReservation,
  ScenicBusOrder, ScenicBusOrderTicket, RefundOrder,
} = require('../models/Summary');

// ---------- 时间工具 ----------
const hourOffset = (n) => new Date(Date.now() + n * 3600e3);
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const dayStr = (d) => d.toISOString().slice(0, 10);
// 统一设置 createdAt/updatedAt，让订单时间线符合状态语义（如"超时取消"发生在过去）
const ts = (n) => ({ createdAt: hourOffset(n), updatedAt: hourOffset(n) });

// ---------- 取真实商品/会员 ID（FK 约束必需）----------
async function firstId(table) {
  const [rows] = await sequelize.query(`SELECT id FROM \`${table}\` ORDER BY id LIMIT 1`);
  if (!rows.length) throw new Error(`表 ${table} 无数据：请先在管理端创建该业务的基础商品数据再跑 seed`);
  return rows[0].id;
}

// ---------- 清理旧的 SEED 数据（按 FK 依赖顺序：先子表后主表）----------
async function cleanOldSeed() {
  console.log('[Seed] 清理旧的 SEED 测试数据...');

  // 夏令营营员明细（FK → camporders）：先查出 seed 订单 id 再删明细
  const seedCampIds = (await campOrders.findAll({
    where: { orderNumber: { [Op.like]: 'SEED-%' } },
    attributes: ['id'],
  })).map(o => o.id);
  if (seedCampIds.length) {
    await sequelize.query('DELETE FROM camporderparticipants WHERE orderId IN (:ids)', {
      replacements: { ids: seedCampIds },
    });
  }

  await RefundOrder.destroy({ where: { refundNo: { [Op.like]: 'SEED-%' } } });
  await ScenicBusOrderTicket.destroy({ where: { ticketNo: { [Op.like]: 'SEED-%' } } });
  await ScenicBusOrder.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
  await Order.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
  await PackageOrderDetail.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
  await HotelOrder.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
  await campOrders.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
  await ParkingReservation.destroy({ where: { orderNumber: { [Op.like]: 'SEED-%' } } });
}

async function up() {
  try {
    console.log('[Seed] 开始插入测试订单数据...');

    // 0. 取真实商品/会员 ID（满足 FK 约束）
    const [memberId, scenicBusId, campTicketId, campsiteId, sessionId, roomPackageId, parkingId] = await Promise.all([
      firstId('members'), firstId('scenicbuses'), firstId('ticket_type'),
      firstId('campsites'), firstId('campsession'), firstId('room_packages'), firstId('parkings'),
    ]);
    console.log(`[Seed] 商品 ID：member=${memberId} scenicBus=${scenicBusId} campTicket=${campTicketId} campsite=${campsiteId} session=${sessionId} roomPackage=${roomPackageId} parking=${parkingId}`);

    // 1. 清理旧 seed（幂等，可重复执行）
    await cleanOldSeed();

    // ========== 1. 票务订单 orders（7 单）==========
    const ticketOrders = [
      {
        orderNumber: 'SEED-TKT-0001', payStatus: 1, verifyStatus: 1, playDate: dayOffset(1), paymentTime: null,
        desc: '待支付', createdAtHours: 0
      },
      {
        orderNumber: 'SEED-TKT-0002', payStatus: 2, verifyStatus: 1, playDate: dayOffset(3), paymentTime: hourOffset(-23),
        desc: '已支付·待核销', createdAtHours: -25
      },
      {
        orderNumber: 'SEED-TKT-0003', payStatus: 2, verifyStatus: 3, playDate: dayOffset(-3), paymentTime: hourOffset(-120),
        desc: '已支付·已过期(超游玩日未核销)', createdAtHours: -144
      },
      {
        orderNumber: 'SEED-TKT-0004', payStatus: 3, verifyStatus: 2, playDate: dayOffset(-2), paymentTime: hourOffset(-96),
        desc: '已完成(已核销)', createdAtHours: -120
      },
      {
        orderNumber: 'SEED-TKT-0005', payStatus: 4, verifyStatus: 1, playDate: dayOffset(-1), paymentTime: hourOffset(-144),
        desc: '已退款·全额', createdAtHours: -168
      },
      {
        orderNumber: 'SEED-TKT-0006', payStatus: 4, verifyStatus: 1, playDate: dayOffset(-1), paymentTime: hourOffset(-140),
        desc: '已退款·部分', createdAtHours: -160, buyNum: '2', orderAmount: '198.00', refundAmount: '99.00'
      },
      {
        orderNumber: 'SEED-TKT-0007', payStatus: 5, verifyStatus: 1, playDate: dayOffset(2), paymentTime: null,
        desc: '已取消', createdAtHours: -2, cancelReason: '超时未支付自动取消'
      },
    ];
    for (const t of ticketOrders) {
      await Order.create({
        orderNumber: t.orderNumber,
        title: '景区成人门票（测试）',
        orderType: 1,
        ticketType: '成人票',
        ticketPrice: '99.00',
        memberId,                     // FK → members（真实会员）
        goodsId: 1,
        userName: '测试用户' + t.orderNumber.slice(-2),
        userPhone: '1380000' + t.orderNumber.slice(-4),
        userIdCard: '110101199001011234',
        playDate: dayStr(t.playDate),
        seat: 'A区3排5座',
        buyNum: t.buyNum || '1',
        payStatus: t.payStatus,
        verifyStatus: t.verifyStatus,
        cancelReason: t.cancelReason || null,
        orderAmount: t.orderAmount || '99.00',
        refundAmount: t.refundAmount || '0',
        alipayTradeNo: t.paymentTime ? 'SEED' + t.orderNumber.replace(/-/g, '') : null,
        paymentTime: t.paymentTime,
        ...ts(t.createdAtHours),
      });
    }
    console.log(`[Seed] 票务订单已插入 ${ticketOrders.length} 单`);

    // ========== 2. 套餐订单 package_order_details（6 单，每单 1 行房型明细）==========
    const pkgOrders = [
      {
        orderNumber: 'SEED-PKG-0001', payStatus: 1, verifyStatus: 1, useDate: dayOffset(2), useEndDate: dayOffset(3),
        desc: '待支付', createdAtHours: 0
      },
      {
        orderNumber: 'SEED-PKG-0002', payStatus: 2, verifyStatus: 1, useDate: dayOffset(4), useEndDate: dayOffset(5),
        desc: '已支付·待核销', createdAtHours: -24, paymentTime: hourOffset(-23)
      },
      {
        orderNumber: 'SEED-PKG-0003', payStatus: 2, verifyStatus: 3, useDate: dayOffset(-6), useEndDate: dayOffset(-5),
        desc: '已支付·已过期', createdAtHours: -160, paymentTime: hourOffset(-150)
      },
      {
        orderNumber: 'SEED-PKG-0004', payStatus: 3, verifyStatus: 2, useDate: dayOffset(-4), useEndDate: dayOffset(-3),
        desc: '已完成(已核销)', createdAtHours: -120, paymentTime: hourOffset(-100), verifyTime: hourOffset(-70)
      },
      {
        orderNumber: 'SEED-PKG-0005', payStatus: 4, verifyStatus: 1, useDate: dayOffset(-2), useEndDate: dayOffset(-1),
        desc: '已退款', createdAtHours: -168, paymentTime: hourOffset(-160), refundAmount: 599
      },
      {
        orderNumber: 'SEED-PKG-0006', payStatus: 5, verifyStatus: 1, useDate: dayOffset(3), useEndDate: dayOffset(4),
        desc: '已取消', createdAtHours: -2, cancelReason: '超时未支付自动取消'
      },
    ];
    for (const p of pkgOrders) {
      await PackageOrderDetail.create({
        title: '亲子度假套餐（测试）',
        orderNumber: p.orderNumber,
        userId: memberId,
        userName: '测试用户' + p.orderNumber.slice(-2),
        userPhone: '1380000' + p.orderNumber.slice(-4),
        buyNum: 1,
        payStatus: p.payStatus,
        cancelReason: p.cancelReason || null,
        orderAmount: 599,
        refundAmount: p.refundAmount || 0,
        alipayTradeNo: p.paymentTime ? 'SEED' + p.orderNumber.replace(/-/g, '') : null,
        paymentTime: p.paymentTime || null,
        packageId: 1,               // 无 FK 约束，测试值
        groupId: 1,                 // 无 FK 约束，测试值
        isPrimary: 1,
        itemType: 1,                // 1=酒店房型
        roomPackageId,              // FK → room_packages（真实套餐）
        itemName: '豪华双床房 1 晚',
        quantity: 1,
        unitPrice: 599,
        useDate: dayStr(p.useDate),
        useEndDate: dayStr(p.useEndDate),
        verifyCode: 'SEEDPKG' + p.orderNumber.slice(-4),
        verifyStatus: p.verifyStatus,
        verifyTime: p.verifyTime || null,
        description: 'seed 测试数据',
        ...ts(p.createdAtHours),
      });
    }
    console.log(`[Seed] 套餐订单已插入 ${pkgOrders.length} 单`);

    // ========== 3. 酒店订单 hotel_order（6 单）==========
    const hotelOrders = [
      {
        orderNumber: 'SEED-HTL-0001', payStatus: 1, verifyStatus: 1, checkIn: dayOffset(2), checkOut: dayOffset(3),
        desc: '待支付', createdAtHours: 0
      },
      {
        orderNumber: 'SEED-HTL-0002', payStatus: 2, verifyStatus: 1, checkIn: dayOffset(3), checkOut: dayOffset(4),
        desc: '已支付·待核销', createdAtHours: -24, paymentTime: hourOffset(-23)
      },
      {
        orderNumber: 'SEED-HTL-0003', payStatus: 2, verifyStatus: 3, checkIn: dayOffset(-4), checkOut: dayOffset(-3),
        desc: '已支付·已过期(超离店日未核销)', createdAtHours: -120, paymentTime: hourOffset(-110)
      },
      {
        orderNumber: 'SEED-HTL-0004', payStatus: 3, verifyStatus: 2, checkIn: dayOffset(-3), checkOut: dayOffset(-2),
        desc: '已完成(已核销)', createdAtHours: -100, paymentTime: hourOffset(-80), verifyTime: hourOffset(-50)
      },
      {
        orderNumber: 'SEED-HTL-0005', payStatus: 4, verifyStatus: 1, checkIn: dayOffset(-1), checkOut: dayOffset(0),
        desc: '已退款', createdAtHours: -168, paymentTime: hourOffset(-160), refundAmount: 776
      },
      {
        orderNumber: 'SEED-HTL-0006', payStatus: 5, verifyStatus: 1, checkIn: dayOffset(2), checkOut: dayOffset(3),
        desc: '已取消', createdAtHours: -2, cancelReason: '超时未支付自动取消'
      },
    ];
    for (const h of hotelOrders) {
      await HotelOrder.create({
        orderNumber: h.orderNumber,
        userId: memberId,
        userPhone: '1380000' + h.orderNumber.slice(-4),
        userName: '测试用户' + h.orderNumber.slice(-2),
        userCard: '110101199001011234',
        transactionNumber: 'SEEDTX' + h.orderNumber.replace(/-/g, ''),
        roomId: 1,                 // 无 FK 约束，测试值
        title: '山景双床房（测试）',
        roomTypeId: 1,             // 无 FK 约束，测试值
        roomCount: 1,
        checkInDate: h.checkIn,
        checkOutDate: h.checkOut,
        payStatus: h.payStatus,
        cancelReason: h.cancelReason || null,
        orderAmount: 776,
        refundAmount: h.refundAmount || 0,
        alipayTradeNo: h.paymentTime ? 'SEED' + h.orderNumber.replace(/-/g, '') : null,
        paymentTime: h.paymentTime || null,
        verifyStatus: h.verifyStatus,
        unitPrice: 388,
        totalPrice: 776,
        verifyCode: 'SEEDHTL' + h.orderNumber.slice(-4),
        verifyTime: h.verifyTime || null,
        ...ts(h.createdAtHours),
      });
    }
    console.log(`[Seed] 酒店订单已插入 ${hotelOrders.length} 单`);

    // ========== 4. 公交订单 scenicbusorder（5 单）+ 车票明细 ==========
    // 订单数据：[订单号, payStatus, quantity, 票状态数组(null=不生成票), 退款额, 描述]
    const busOrders = [
      {
        orderNumber: 'SEED-BUS-0001', payStatus: 1, quantity: 2, ticketStatuses: null, refundAmount: 0,
        rideDate: dayOffset(1), desc: '待支付(未生成票)', createdAtHours: 0, cancelReason: null, paymentTime: null
      },
      {
        orderNumber: 'SEED-BUS-0002', payStatus: 2, quantity: 3, ticketStatuses: [1, 2, 4], refundAmount: 20,
        rideDate: dayOffset(2), desc: '已支付·部分核销(1待乘车+1已核销+1已退票)', createdAtHours: -24, cancelReason: null, paymentTime: hourOffset(-23)
      },
      {
        orderNumber: 'SEED-BUS-0003', payStatus: 3, quantity: 2, ticketStatuses: [2, 2], refundAmount: 0,
        rideDate: dayOffset(-1), desc: '已完成(票全部核销)', createdAtHours: -72, cancelReason: null, paymentTime: hourOffset(-70)
      },
      {
        orderNumber: 'SEED-BUS-0004', payStatus: 4, quantity: 2, ticketStatuses: [4, 4], refundAmount: 40,
        rideDate: dayOffset(-1), desc: '已退款(票全部退票)', createdAtHours: -120, cancelReason: null, paymentTime: hourOffset(-110)
      },
      {
        orderNumber: 'SEED-BUS-0005', payStatus: 5, quantity: 2, ticketStatuses: null, refundAmount: 0,
        rideDate: dayOffset(1), desc: '已取消(未生成票)', createdAtHours: -2, cancelReason: '超时未支付自动取消', paymentTime: null
      },
    ];
    let busTicketCount = 0;
    for (const b of busOrders) {
      const order = await ScenicBusOrder.create({
        orderNumber: b.orderNumber,
        userId: memberId,
        userPhone: '1380000' + b.orderNumber.slice(-4),
        contactName: '测试用户' + b.orderNumber.slice(-2),
        scenicBusId,                   // FK → scenicbuses（真实线路）
        title: '景区观光巴士 1号线（测试）',
        ticketType: 1,                 // 1-成人
        rideDate: dayStr(b.rideDate),
        timeSlot: '08:00-12:00',
        quantity: b.quantity,
        totalAmount: b.quantity * 20,
        orderAmount: b.quantity * 20,
        refundAmount: b.refundAmount,
        payMethod: 2,
        payStatus: b.payStatus,
        transactionNumber: b.paymentTime ? 'SEEDTX' + b.orderNumber.replace(/-/g, '') : null,
        paymentTime: b.paymentTime,
        cancelReason: b.cancelReason,
        ...ts(b.createdAtHours),
      });
      // 车票明细（一票一码）：已支付及之后的状态才生成票
      if (b.ticketStatuses) {
        for (let i = 0; i < b.ticketStatuses.length; i++) {
          const st = b.ticketStatuses[i]; // 1待乘车 2已核销 3已过期 4已退票
          await ScenicBusOrderTicket.create({
            orderId: order.id,        // FK → scenicbusorder
            seq: i + 1,
            ticketNo: `${b.orderNumber}-T${i + 1}`,
            verifyCode: `SEEDBUS${b.orderNumber.slice(-4)}${i + 1}`,
            verifyStatus: st,
            verifyTime: st === 2 ? hourOffset(-20 + i) : null,
            verifiedBy: st === 2 ? 1 : null,
            refundTime: st === 4 ? hourOffset(-100 + i) : null,
            ticketAmount: 20,
            refundAmount: st === 4 ? 20 : 0,
            ...ts(b.createdAtHours),
          });
          busTicketCount++;
        }
      }
    }
    console.log(`[Seed] 公交订单已插入 ${busOrders.length} 单（含 ${busTicketCount} 张票明细）`);

    // ========== 5. 夏令营订单 campOrders（5 单）==========
    const campOrderList = [
      {
        orderNumber: 'SEED-CAMP-0001', payStatus: 1, start: dayOffset(5), end: dayOffset(9),
        desc: '待支付', createdAtHours: 0, paymentTime: null
      },
      {
        orderNumber: 'SEED-CAMP-0002', payStatus: 2, start: dayOffset(6), end: dayOffset(10),
        desc: '已支付(待开营)', createdAtHours: -24, paymentTime: hourOffset(-23)
      },
      {
        orderNumber: 'SEED-CAMP-0003', payStatus: 3, start: dayOffset(-9), end: dayOffset(-5),
        desc: '已完成(已结营)', createdAtHours: -240, paymentTime: hourOffset(-230)
      },
      {
        orderNumber: 'SEED-CAMP-0004', payStatus: 4, start: dayOffset(3), end: dayOffset(7),
        desc: '已退款', createdAtHours: -168, paymentTime: hourOffset(-160)
      },
      {
        orderNumber: 'SEED-CAMP-0005', payStatus: 5, start: dayOffset(5), end: dayOffset(9),
        desc: '已取消', createdAtHours: -2, paymentTime: null, cancelReason: '超时未支付自动取消'
      },
    ];
    for (const c of campOrderList) {
      await campOrders.create({
        title: '少年自然探索营（测试）',
        orderNumber: c.orderNumber,
        userId: memberId,
        userPhone: '1380000' + c.orderNumber.slice(-4),
        ticketId: campTicketId,      // FK → ticket_type（真实票档）
        campsiteId,                  // 真实营地
        sessionId,                   // 真实场次
        startDate: c.start,
        endDate: c.end,
        peopleCount: 2,
        totalAmount: 5998,
        discount: 0,
        orderAmount: 5998,
        payMethod: 2,
        payStatus: c.payStatus,
        alipayTradeNo: c.paymentTime ? 'SEED' + c.orderNumber.replace(/-/g, '') : null,
        paymentTime: c.paymentTime,
        remark: 'seed 测试数据',
        cancelReason: c.cancelReason || null,
        ...ts(c.createdAtHours),
      });
    }
    console.log(`[Seed] 夏令营订单已插入 ${campOrderList.length} 单`);

    // ========== 6. 停车预约 parking_reservation（4 单）==========
    const parkingList = [
      {
        orderNumber: 'SEED-PARK-0001', payStatus: 1, start: hourOffset(2), end: hourOffset(5),
        desc: '待支付', createdAtHours: 0, paymentTime: null, cancelReason: null
      },
      {
        orderNumber: 'SEED-PARK-0002', payStatus: 3, start: hourOffset(-5), end: hourOffset(-2),
        desc: '已完成(停车支付即核销)', createdAtHours: -6, paymentTime: hourOffset(-5.5), cancelReason: null
      },
      {
        orderNumber: 'SEED-PARK-0003', payStatus: 4, start: hourOffset(-30), end: hourOffset(-27),
        desc: '已退款(管理员强制退款)', createdAtHours: -32, paymentTime: hourOffset(-30), cancelReason: '管理员强制退款'
      },
      {
        orderNumber: 'SEED-PARK-0004', payStatus: 5, start: hourOffset(3), end: hourOffset(6),
        desc: '已取消', createdAtHours: -2, paymentTime: null, cancelReason: '超时未支付自动取消'
      },
    ];
    for (const p of parkingList) {
      await ParkingReservation.create({
        orderNumber: p.orderNumber,
        title: '景区南门停车场预约（测试）',
        parkingId,                 // FK → parkings（真实停车场）
        spotId: 0,                  // 无 FK 约束
        spotNumber: 'A-01',
        userId: memberId,
        idCard: '110101199001011234',
        phone: '1380000' + p.orderNumber.slice(-4),
        carNumber: '京A12345',
        startTime: p.start,
        endTime: p.end,
        orderAmount: 45,
        payStatus: p.payStatus,
        paymentTime: p.paymentTime,
        tradeNo: p.paymentTime ? 'SEEDTX' + p.orderNumber.replace(/-/g, '') : null,
        writeOffCode: p.payStatus === 3 ? 'SEEDWOC' + p.orderNumber.slice(-4) : null,
        cancelReason: p.cancelReason,
        ...ts(p.createdAtHours),
      });
    }
    console.log(`[Seed] 停车预约已插入 ${parkingList.length} 单`);

    // ========== 7. 退款单 refund_orders（2 条，FK orderNo 只能指向 orders 票务订单）==========
    const refunds = [
      { refundNo: 'SEED-RFD-0001', orderNo: 'SEED-TKT-0005', refundAmount: 99, refundType: 1, reason: '用户申请全额退款（seed）' },
      { refundNo: 'SEED-RFD-0002', orderNo: 'SEED-TKT-0006', refundAmount: 99, refundType: 2, reason: '部分退款 1 张（seed）' },
    ];
    for (const r of refunds) {
      await RefundOrder.create({
        refundNo: r.refundNo,
        orderNo: r.orderNo,          // FK → orders.orderNumber（seed 票务单）
        userPhone: '1380000' + r.orderNo.slice(-4),
        refundAmount: r.refundAmount,
        ticketId: 1,
        ticketName: '景区成人门票（测试）',
        refundReason: r.reason,
        refundStatus: 1,             // 1-退款成功
        refundType: r.refundType,
        auditorName: 'admin',
        auditTime: hourOffset(-140),
        orderType: 1,                // 1-票务
        ...ts(-140),
      });
    }
    console.log(`[Seed] 退款单已插入 ${refunds.length} 条`);

    // ========== 汇总输出 ==========
    console.log('\n[Seed] 插入完成，各表 SEED 订单状态分布：');
    const dist = {};
    const tables = [
      ['票务 orders', Order], ['套餐 package_order_details', PackageOrderDetail],
      ['酒店 hotel_order', HotelOrder], ['公交 scenicbusorder', ScenicBusOrder],
      ['夏令营 campOrders', campOrders], ['停车 parking_reservation', ParkingReservation],
    ];
    for (const [label, model] of tables) {
      const rows = await model.findAll({
        where: { orderNumber: { [Op.like]: 'SEED-%' } },
        attributes: ['payStatus'],
        raw: true,
      });
      const by = {};
      rows.forEach(r => { by[r.payStatus] = (by[r.payStatus] || 0) + 1; });
      dist[label] = by;
    }
    console.log(JSON.stringify(dist, null, 2));

    console.log('[Seed] 提醒：SEED-TKT-0001 / PKG-0001 / HTL-0001 / BUS-0001 / CAMP-0001 / PARK-0001 为待支付单，');
    console.log('       orderExpireTask 定时任务开启 10 分钟后它们会被自动取消（payStatus→5），可用于验证定时任务。');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] 插入失败:', error.message);
    process.exit(1);
  }
}

up();
