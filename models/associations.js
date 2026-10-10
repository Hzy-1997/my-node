/**
 * 模型关联配置文件
 * 集中管理所有模型之间的关联关系，避免循环引用问题
 */

// 导入所有模型
const { Member } = require('./memberModel/index');
const { Order } = require('./orderModel/index');
const { RefundOrder } = require('./refundModel/index');
const { Hotel } = require('./hotelModel/hotel');
const { RoomType } = require('./hotelModel/roomType');
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
const { Parking } = require('./appointment/parkingModel');
const { ParkingReservation } = require('./appointment/parkingReservation');
const { ParkingSpot } = require('./appointment/parkingSpotModel');



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
        foreignKey: 'ticketTypeId',
        sourceKey: 'id',
        as: 'orders',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })

    campOrders.belongsTo(TicketType, {
        foreignKey: 'ticketTypeId',
        targetKey: 'id',
        as: 'ticketType',
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

    // ==================== PackageOrderDetail & RoomPackage 关联（酒店房型）====================
    PackageOrderDetail.belongsTo(RoomPackage, {
        foreignKey: 'room_package_id',
        targetKey: 'id',
        as: 'roomPackage',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    RoomPackage.hasMany(PackageOrderDetail, {
        foreignKey: 'room_package_id',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageOrderDetail & Ticket 关联（门票）====================
    PackageOrderDetail.belongsTo(Ticket, {
        foreignKey: 'ticket_id',
        targetKey: 'id',
        as: 'ticket',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    Ticket.hasMany(PackageOrderDetail, {
        foreignKey: 'ticket_id',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    // ==================== PackageOrderDetail & PriceRule 关联（门票价格规则）====================
    PackageOrderDetail.belongsTo(PriceRule, {
        foreignKey: 'ticket_price_rule_id',
        targetKey: 'id',
        as: 'ticketPriceRule',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    PriceRule.hasMany(PackageOrderDetail, {
        foreignKey: 'ticket_price_rule_id',
        sourceKey: 'id',
        as: 'orderDetails',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    });

    console.log('模型关联关系已建立');
}

module.exports = { setupAssociations };
