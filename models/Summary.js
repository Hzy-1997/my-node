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

// 表 创 建
const { User } = require('./userModel/user');
const { Dept, DeptParent } = require('./deptModel/index');
const { Role, UserRole, MenuRole } = require('./roleModel/index');
const { Menu } = require('./menuModel/index');

// 会员
const { Member } = require("./memberModel/index")

// 演出
const { Ticket, holiday } = require("./ticketModel/index")
const { PriceRule } = require("./ticketModel/priceRule")
const { Seat } = require("./seatModel/index")
const { Order } = require("./orderModel/index")
const { WriteOff } = require("./ticketModel/writeOff")

// 攻略 运动 休闲 餐饮 购物
const { Strategy } = require("./strategyModel/index")
const { FitnessExercise } = require("./strategyModel/fitnessExerciseModel")
const { Leisure } = require("./strategyModel/LeisureModel")
const { Restaurant } = require("./strategyModel/restaurantModel")
const { DiscountStore } = require("./strategyModel/discountStoreModel")


// const { DiscountStore, Restaurant, FitnessExercise, Leisure } = require("./strategyModel/index")

// 酒店
const { Hotel } = require("./hotelModel/hotel");
const { RoomType } = require("./hotelModel/roomType");
const { RoomPackage } = require("./hotelModel/roomPackage");
const { RoomPriceRule } = require("./hotelModel/roomPriceRule");
const { RoomDatePrice } = require("./hotelModel/roomDatePrice");
const { RoomInventory } = require("./hotelModel/roomInventory");
const { HotelOrder } = require("./hotelModel/hotelOrder");

// 日志
const { OperLog } = require("./operLogModel/operLog")

// 补偿任务
const { CompensationTask } = require("./compensationTaskModel/index")

// 退款单
const { RefundOrder } = require("./refundModel/index")

// 套餐
const { ProductPackage, PackageItem, PackagePriceRule, PackageDatePrice, PackageOrderDetail } = require("./packageModel/index")

// 夏令营
const { campOrders } = require("./appointment/campOrdersModel")
const { campOrderParticipants } = require("./appointment/campOrderParticipantsModel")
const { CampSession } = require("./appointment/campSessionModel")
const { Campsite } = require("./appointment/campsiteModel")

//车位预约
const { Parking } = require("./appointment/parkingModel")
const { ParkingReservation } = require("./appointment/parkingReservation")
const { ParkingSpot } = require("./appointment/parkingSpotModel")
const { TicketType } = require("./appointment/ticketType")

// 景区公交
const { ScenicBus } = require("./appointment/scenicBusModel")
const { ScenicBusOrder } = require("./appointment/scenicBusOrderModel")
const { ScenicBusOrderTicket } = require("./appointment/scenicBusOrderTicketModel")



module.exports = {
    User,
    Dept, DeptParent,
    Role, UserRole, MenuRole,
    Menu,
    Member,
    Order,
    Ticket, Seat, PriceRule, holiday, WriteOff,
    Strategy, FitnessExercise, Leisure, Restaurant, DiscountStore,
    Hotel, RoomType, RoomPackage, RoomPriceRule, RoomDatePrice, RoomInventory, HotelOrder,
    OperLog,
    CompensationTask,
    RefundOrder,
    ProductPackage, PackageItem, PackagePriceRule, PackageDatePrice, PackageOrderDetail,
    campOrders, campOrderParticipants, CampSession, Campsite, Parking, ParkingReservation, ParkingSpot, TicketType,
    ScenicBus, ScenicBusOrder, ScenicBusOrderTicket
};