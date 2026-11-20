/**
 * 模型关联配置文件
 * 集中管理所有模型之间的关联关系，避免循环引用问题
 *
 * ============ 三种关联关系用法说明 ============
 *
 * 一、hasMany（一对多）：一个 A 对应多个 B，外键定义在 B 表
 *    语法：A.hasMany(B, { foreignKey, sourceKey, as, onDelete, onUpdate })
 *    - foreignKey：外键字段，定义在 B（目标模型）表中
 *    - sourceKey：A（源模型）表中用于关联的字段，默认为主键
 *    - as：别名，查询时通过 include: [{ model: B, as: '别名' }] 引用
 *    查询：A.findAll({ include: [{ model: B, as: 'xxx' }] }) → 结果为数组
 *    示例：Member.hasMany(Order) → 一个会员有多笔订单（订单表持有 memberId）
 *
 * 二、belongsTo（多对一，属于）：B 属于 A，外键定义在 B 表（当前模型自己持有外键）
 *    语法：B.belongsTo(A, { foreignKey, targetKey, as, onDelete, onUpdate })
 *    - foreignKey：外键字段，定义在 B（当前模型）表中
 *    - targetKey：A（目标模型）表中用于关联的字段，默认为主键
 *    查询：B.findAll({ include: [{ model: A, as: 'xxx' }] }) → 结果为单个对象
 *    示例：Order.belongsTo(Member) → 订单归属某个会员（订单表持有 memberId）
 *    注意：hasMany 与 belongsTo 成对出现，描述同一条外键关系的两个查询方向
 *
 * 三、belongsToMany（多对多）：A 与 B 互为多对多，需通过中间表 C 关联
 *    语法：A.belongsToMany(B, { through: C, foreignKey, otherKey, as })
 *    - through：中间表模型（存储两端的关联关系）
 *    - foreignKey：中间表中指向 A（当前模型）的外键
 *    - otherKey：中间表中指向 B（目标模型）的外键
 *    查询：A.findAll({ include: [{ model: B, as: 'xxx' }] }) → 结果为数组
 *    示例：User.belongsToMany(Role, { through: UserRole })
 *         → 一个用户可以有多个角色，一个角色也可以属于多个用户
 *
 * 公共配置项：
 *    - onDelete：删除主表记录时对子表的处理，CASCADE（级联删除）/ SET NULL（置空）/ RESTRICT（禁止删除）
 *    - onUpdate：更新主表关联键时子表的处理，通常为 CASCADE（级联更新）
 *    - hooks: true：让 onDelete 的级联行为通过钩子在应用层执行（配合 paranoid 或无外键约束时使用）
 *
 * 查询示例：
 *    // 一对多：查会员并带出其所有订单（orders 为数组）
 *    Member.findAll({ include: [{ model: Order, as: 'orders' }] })
 *    // 反向：查订单并带出所属会员（member 为单个对象）
 *    Order.findAll({ include: [{ model: Member, as: 'member' }] })
 *    // 多对多：查用户并带出其所有角色（数组）
 *    User.findAll({ include: [{ model: Role, as: 'Roles' }] })
 */

// 导入所有模型
const { Member } = require('./memberModel/index');
const { Order } = require('./orderModel/index');
const { RefundOrder } = require('./refundModel/index');
const { Hotel } = require('./hotelModel/hotel');
const { RoomType } = require('./hotelModel/roomType');
const { HotelOrder } = require('./hotelModel/hotelOrder');
const { RoomPackage } = require('./hotelModel/roomPackage');
const { RoomPriceRule } = require('./hotelModel/roomPriceRule');
const { RoomDatePrice } = require('./hotelModel/roomDatePrice');
const { RoomInventory } = require('./hotelModel/roomInventory');
const { Ticket } = require('./ticketModel/index');
const { PriceRule } = require('./ticketModel/priceRule');
const { Dept, DeptParent } = require('./deptModel/index');
const { Role, UserRole, MenuRole } = require('./roleModel/index');
const { Menu } = require('./menuModel/index');
const { User } = require('./userModel/user');
const { ProductPackage, PackageItem, PackagePriceRule, PackageDatePrice, PackageOrderDetail } = require('./packageModel/index');
const { Campsite } = require('./appointment/campsiteModel');
const { TicketType } = require('./appointment/ticketType');
const { CampSession } = require("./appointment/campSessionModel");
const { campOrders } = require("./appointment/campOrdersModel");
const { campOrderParticipants } = require("./appointment/campOrderParticipantsModel");
const { Parking } = require('./appointment/parkingModel');
const { ParkingReservation } = require('./appointment/parkingReservation');
const { ParkingSpot } = require('./appointment/parkingSpotModel');
const { ScenicBus } = require('./appointment/scenicBusModel');
const { ScenicBusOrder } = require('./appointment/scenicBusOrderModel');
const { ScenicBusOrderTicket } = require('./appointment/scenicBusOrderTicketModel');
const { Reminder } = require("./reminderModel/index")
const { Performance } = require('./performanceModel/performance');
const { PerformanceSchedule } = require('./performanceModel/performanceSchedule');



function setupAssociations() {
    // ==================== Member & Order 关联 ====================
    Member.hasMany(Order, {
        foreignKey: 'memberId',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Order.belongsTo(Member, {
        foreignKey: 'memberId',
        as: 'member',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== Hotel & RoomType 关联 ====================
    Hotel.hasMany(RoomType, {
        foreignKey: 'hotel_id',
        sourceKey: 'id',
        as: 'roomTypes',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RoomType.belongsTo(Hotel, {
        foreignKey: 'hotel_id',
        targetKey: 'id',
        as: 'hotel',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== RoomType & RoomPackage 关联 ====================
    RoomType.hasMany(RoomPackage, {
        foreignKey: 'room_type_id',
        sourceKey: 'id',
        as: 'packages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RoomPackage.belongsTo(RoomType, {
        foreignKey: 'room_type_id',
        targetKey: 'id',
        as: 'roomType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== RoomPackage & RoomDatePrice 关联 ====================
    RoomPackage.hasMany(RoomDatePrice, {
        foreignKey: 'room_package_id',
        sourceKey: 'id',
        as: 'datePrices',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RoomDatePrice.belongsTo(RoomPackage, {
        foreignKey: 'room_package_id',
        targetKey: 'id',
        as: 'package',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== RoomType & RoomInventory 关联（房型每日共享库存）====================
    RoomType.hasMany(RoomInventory, {
        foreignKey: 'roomTypeId',
        sourceKey: 'id',
        as: 'inventories',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RoomInventory.belongsTo(RoomType, {
        foreignKey: 'roomTypeId',
        targetKey: 'id',
        as: 'roomType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== HotelOrder & RoomType 关联 ====================

    HotelOrder.belongsTo(RoomType, {
        foreignKey: 'roomId',
        targetKey: 'id',
        as: 'roomType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    RoomType.hasMany(HotelOrder, {
        foreignKey: 'roomId',
        sourceKey: 'id',
        as: 'hotelOrders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    // ==================== RoomPackage & RoomPriceRule 关联 ====================
    RoomPackage.hasOne(RoomPriceRule, {
        foreignKey: 'room_package_id',
        sourceKey: 'id',
        as: 'priceRule',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RoomPriceRule.belongsTo(RoomPackage, {
        foreignKey: 'room_package_id',
        targetKey: 'id',
        as: 'package',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== Order & Ticket 关联（票务订单）====================
    // 注意：goodsId 是多态字段（orderType=1 指向票务，2 指向套餐），不做级联删除
    Order.belongsTo(Ticket, {
        foreignKey: 'goodsId',
        targetKey: 'id',
        as: 'ticket'
    });

    Ticket.hasMany(Order, {
        foreignKey: 'goodsId',
        sourceKey: 'id',
        as: 'orders'
    });

    // ==================== Ticket & PriceRule 关联 ====================
    Ticket.hasMany(PriceRule, {
        foreignKey: 'ticketId',
        sourceKey: 'id',
        constraints: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        as: 'priceRules'
    });

    PriceRule.belongsTo(Ticket, {
        foreignKey: 'ticketId',
        targetKey: 'id',
        constraints: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        as: 'ticket'
    });

    // ==================== 夏令营模块关联（Campsite / CampSession / TicketType）====================
    // Campsite & TicketType（营地 -> 票档）
    Campsite.hasMany(TicketType, {
        foreignKey: 'campId',
        sourceKey: 'id',
        as: 'ticketTypes',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    TicketType.belongsTo(Campsite, {
        foreignKey: 'campId',
        targetKey: 'id',
        as: 'camp',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Campsite & CampSession（营地 -> 场次）
    Campsite.hasMany(CampSession, {
        foreignKey: 'campId',
        sourceKey: 'id',
        as: 'campSessions',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    CampSession.belongsTo(Campsite, {
        foreignKey: 'campId',
        targetKey: 'id',
        as: 'camp',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // CampSession & TicketType（场次 -> 票档，sessionId 可为空，删场次时置空）
    CampSession.hasMany(TicketType, {
        foreignKey: 'sessionId',
        sourceKey: 'id',
        as: 'ticketTypes',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    TicketType.belongsTo(CampSession, {
        foreignKey: 'sessionId',
        targetKey: 'id',
        as: 'session',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    TicketType.hasMany(campOrders, {
        foreignKey: 'ticketId',
        sourceKey: 'id',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    campOrders.belongsTo(TicketType, {
        foreignKey: 'ticketId',
        targetKey: 'id',
        as: 'ticketType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    // campOrders & Campsite（订单 -> 营地）
    campOrders.belongsTo(Campsite, {
        foreignKey: 'campsiteId',
        targetKey: 'id',
        as: 'campsite',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    Campsite.hasMany(campOrders, {
        foreignKey: 'campsiteId',
        sourceKey: 'id',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    // campOrders & CampSession（订单 -> 场次）
    campOrders.belongsTo(CampSession, {
        foreignKey: 'sessionId',
        targetKey: 'id',
        as: 'session',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    CampSession.hasMany(campOrders, {
        foreignKey: 'sessionId',
        sourceKey: 'id',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    // campOrders & campOrderParticipants（订单 -> 营员明细，一单多人）
    campOrders.hasMany(campOrderParticipants, {
        foreignKey: 'orderId',
        sourceKey: 'id',
        as: 'participants',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    campOrderParticipants.belongsTo(campOrders, {
        foreignKey: 'orderId',
        targetKey: 'id',
        as: 'order',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })


    // ==================== 停车场模块关联（ParkingModel / ParkingReservation）====================

    Parking.hasMany(ParkingReservation, {
        foreignKey: 'parkingId',
        sourceKey: 'id',
        as: 'reservations',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    ParkingReservation.belongsTo(Parking, {
        foreignKey: 'parkingId',
        targetKey: 'id',
        as: 'parking',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Parking & ParkingSpot（停车场 -> 车位）
    Parking.hasMany(ParkingSpot, {
        foreignKey: 'parkingId',
        sourceKey: 'id',
        as: 'spots',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    ParkingSpot.belongsTo(Parking, {
        foreignKey: 'parkingId',
        targetKey: 'id',
        as: 'parking',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ParkingSpot & ParkingReservation（车位 -> 预约单）
    // 注意：不带 CASCADE，保留预约历史记录；删除车位前需校验无关联预约
    ParkingSpot.hasMany(ParkingReservation, {
        foreignKey: 'spotId',
        sourceKey: 'id',
        as: 'spotReservations'
    });

    ParkingReservation.belongsTo(ParkingSpot, {
        foreignKey: 'spotId',
        targetKey: 'id',
        as: 'spot'
    });


    // ==================== 景区公交模块关联（ScenicBus / ScenicBusOrder / ScenicBusOrderTicket）====================

    // ScenicBus & ScenicBusOrder（公交班次 -> 订单）
    ScenicBus.hasMany(ScenicBusOrder, {
        foreignKey: 'scenicBusId',
        sourceKey: 'id',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    ScenicBusOrder.belongsTo(ScenicBus, {
        foreignKey: 'scenicBusId',
        targetKey: 'id',
        as: 'scenicBus',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ScenicBusOrder & ScenicBusOrderTicket（订单 -> 车票明细，一单多票、一票一码）
    // 核销与退票均以"票"为单位：单张票独立核销/退票，全部核销后订单才算完成
    ScenicBusOrder.hasMany(ScenicBusOrderTicket, {
        foreignKey: 'orderId',
        sourceKey: 'id',
        as: 'tickets',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    ScenicBusOrderTicket.belongsTo(ScenicBusOrder, {
        foreignKey: 'orderId',
        targetKey: 'id',
        as: 'order',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== Dept 自关联（父子部门） ====================
    Dept.belongsToMany(Dept, {
        through: DeptParent,
        foreignKey: 'childId',
        otherKey: 'parentId',
        as: 'Parents',
        onDelete: 'CASCADE'
    });

    Dept.belongsToMany(Dept, {
        through: DeptParent,
        foreignKey: 'parentId',
        otherKey: 'childId',
        as: 'Children',
        onDelete: 'CASCADE'
    });

    // ==================== User & Dept 关联 ====================
    User.belongsTo(Dept, {
        foreignKey: {
            name: 'deptId',
            allowNull: true
        },
        as: 'department',
        onDelete: 'SET NULL'
    });

    Dept.hasMany(User, {
        foreignKey: 'deptId',
        as: 'users',
        onDelete: 'SET NULL'
    });

    Dept.belongsTo(User, {
        foreignKey: 'leaderId',
        as: 'leader',
        onDelete: 'SET NULL'
    });

    // ==================== User & Role 多对多关联 ====================
    User.belongsToMany(Role, {
        through: UserRole,
        onDelete: 'CASCADE',
        hooks: true
    });

    Role.belongsToMany(User, {
        through: UserRole,
        onDelete: 'CASCADE',
        hooks: true
    });

    // ==================== Role & Menu 多对多关联 ====================
    Menu.belongsToMany(Role, {
        through: MenuRole,
        onDelete: 'CASCADE',
        hooks: true
    });

    Role.belongsToMany(Menu, {
        through: MenuRole,
        onDelete: 'CASCADE',
        hooks: true
    });

    // ==================== Menu 自关联（父子菜单） ====================
    Menu.belongsTo(Menu, {
        foreignKey: 'parentId',
        as: 'parentMenu',
        onDelete: 'CASCADE',
        hooks: true
    });

    Menu.hasMany(Menu, {
        foreignKey: 'parentId',
        as: 'subMenus',
        onDelete: 'CASCADE',
        hooks: true
    });

    // ==================== Order & RefundOrder 关联 ====================
    Order.hasMany(RefundOrder, {
        foreignKey: 'orderNo',
        sourceKey: 'orderNumber',
        as: 'refundOrders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    RefundOrder.belongsTo(Order, {
        foreignKey: 'orderNo',
        targetKey: 'orderNumber',
        as: 'order',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== ProductPackage & PackageItem 关联 ====================
    ProductPackage.hasMany(PackageItem, {
        foreignKey: 'packageId',
        sourceKey: 'id',
        as: 'items',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    PackageItem.belongsTo(ProductPackage, {
        foreignKey: 'packageId',
        targetKey: 'id',
        as: 'package',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageItem & PackagePriceRule 关联 ====================
    PackageItem.hasOne(PackagePriceRule, {
        foreignKey: 'packageItemId',  // PackagePriceRule 表中的外键
        sourceKey: 'id',
        as: 'priceRule',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });


    PackagePriceRule.belongsTo(PackageItem, {
        foreignKey: 'packageItemId',
        targetKey: 'id',
        as: 'packageItem',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageItem & PackageDatePrice 关联 ====================
    PackageItem.hasMany(PackageDatePrice, {
        foreignKey: 'package_item_id',
        sourceKey: 'id',
        as: 'datePrices',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    PackageDatePrice.belongsTo(PackageItem, {
        foreignKey: 'package_item_id',
        targetKey: 'id',
        as: 'packageItem',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageItem & RoomPackage 关联（酒店房型）====================
    PackageItem.belongsTo(RoomPackage, {
        foreignKey: 'roomPackageId',
        targetKey: 'id',
        as: 'roomPackage',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    RoomPackage.hasMany(PackageItem, {
        foreignKey: 'roomPackageId',
        sourceKey: 'id',
        as: 'packageItems',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageItem & Ticket 关联（门票）====================
    PackageItem.belongsTo(Ticket, {
        foreignKey: 'ticketId',
        targetKey: 'id',
        as: 'ticket',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    Ticket.hasMany(PackageItem, {
        foreignKey: 'ticketId',
        sourceKey: 'id',
        as: 'packageItems',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageItem & PriceRule 关联（门票价格规则）====================
    PackageItem.belongsTo(PriceRule, {
        foreignKey: 'ticketPriceRuleId',
        targetKey: 'id',
        as: 'ticketPriceRule',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    PriceRule.hasMany(PackageItem, {
        foreignKey: 'ticketPriceRuleId',
        sourceKey: 'id',
        as: 'packageItems',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageOrderDetail & ProductPackage 关联（所属套餐）====================
    PackageOrderDetail.belongsTo(ProductPackage, {
        foreignKey: 'packageId',
        targetKey: 'id',
        as: 'package'
    });

    ProductPackage.hasMany(PackageOrderDetail, {
        foreignKey: 'packageId',
        sourceKey: 'id',
        as: 'orderDetails'
    });

    // ==================== PackageOrderDetail & RoomPackage 关联（酒店房型）====================
    // 注意：foreignKey 用模型里已定义的属性名（驼峰），实际列名 room_package_id 由 underscored 自动映射
    PackageOrderDetail.belongsTo(RoomPackage, {
        foreignKey: 'roomPackageId',
        targetKey: 'id',
        as: 'roomPackage',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    RoomPackage.hasMany(PackageOrderDetail, {
        foreignKey: 'roomPackageId',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageOrderDetail & Ticket 关联（门票）====================
    PackageOrderDetail.belongsTo(Ticket, {
        foreignKey: 'ticketId',
        targetKey: 'id',
        as: 'ticket',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    Ticket.hasMany(PackageOrderDetail, {
        foreignKey: 'ticketId',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageOrderDetail & PriceRule 关联（门票价格规则）====================
    PackageOrderDetail.belongsTo(PriceRule, {
        foreignKey: 'ticketPriceRuleId',
        targetKey: 'id',
        as: 'ticketPriceRule',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    PriceRule.hasMany(PackageOrderDetail, {
        foreignKey: 'ticketPriceRuleId',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== Reminder & Member 关联（用户）====================
    Reminder.belongsTo(Member, {
        foreignKey: 'userId', // 订阅提醒的用户ID  Reminder表中的userId
        targetKey: 'id', // Member表中的ID
        as: 'member',  // 关联的用户模型别名
        onDelete: 'CASCADE', // 当用户被删除时，关联的提醒也会被删除
        onUpdate: 'CASCADE' // 当用户信息更新时，关联的提醒也会被更新
    });

    Member.hasMany(Reminder, {
        foreignKey: 'userId', // 订阅提醒的用户ID  Member表中的userId
        sourceKey: 'id', // Reminder表中的ID
        as: 'reminders', // 关联的提醒模型别名
        onDelete: 'SET NULL', // 当用户被删除时，关联的提醒也会被删除
        onUpdate: 'CASCADE' // 当用户信息更新时，关联的提醒也会被更新
    });

        // ==================== Reminder & Performance 关联（演出）====================
    Reminder.belongsTo(Performance, {
        foreignKey: 'projectId', // 订阅提醒的演出ID  Reminder表中的performanceId
        targetKey: 'id', // Performance表中的ID
        as: 'performance', // 关联的演出模型别名
        onDelete: 'CASCADE', // 当演出被删除时，关联的提醒也会被删除
        onUpdate: 'CASCADE' // 当演出信息更新时，关联的提醒也会被更新
    })
    Performance.hasMany(Reminder, {
        foreignKey: 'projectId', // 订阅提醒的演出ID  Performance表中的performanceId
        sourceKey: 'id', // Reminder表中的ID
        as: 'reminders', // 关联的提醒模型别名
        onDelete: 'SET NULL', // 当演出被删除时，关联的提醒也会被删除
        onUpdate: 'CASCADE' // 当演出信息更新时，关联的提醒也会被更新
    })



    // ==================== 演艺演出模块关联（Performance / PerformanceSchedule）====================
    // Performance & PerformanceSchedule（演出 -> 场次，删除演出时级联删除其全部场次）
    Performance.hasMany(PerformanceSchedule, {
        foreignKey: 'performanceId',
        sourceKey: 'id',
        as: 'schedules',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    PerformanceSchedule.belongsTo(Performance, {
        foreignKey: 'performanceId',
        targetKey: 'id',
        as: 'performance',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    console.log('模型关联关系已建立');
}

module.exports = {
    setupAssociations
};
