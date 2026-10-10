// 停车场表
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");


const ParkingReservation = sequelize.define("ParkingReservation", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    // 订单号
    orderNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '订单编号',
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '订单标题',
    },
    // 关联停车场
    parkingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "停车场ID",
    },
    // 关联车位（用户预约时选择的具体车位）
    spotId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "车位ID（关联 parking_spots 表）",
    },
    // 车位编号（下单时冗余存储，车位后续改名不影响历史订单展示）
    spotNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '',
        comment: "车位编号（冗余存储）",
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "用户ID",
    },
    // 身份证号
    idCard: {
        type: DataTypes.STRING,
        allowNull: true, 
        comment: '身份证号',
    },
    // 联系电话
    phone: {
        type: DataTypes.STRING,
        allowNull: false, 
        comment: '联系电话',
    },
    carNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "车牌号",
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "开始时间",
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "结束时间",
    },
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "预约金额",
    },
    payStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '支付状态：1未支付 2已支付 3已退款',
    },
    paymentTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '支付时间',
    },
    tradeNo: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: '交易号',
    },
    writeOffCode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "核销编码",
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "预约状态(0:待确认,1:已确认,2:已取消,3:已完成,4:已作废)", // 4=已支付但未在预约时段内使用，订单终结不可再用
    },
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '取消原因',
    },

},
    {
        tableName: "parking_reservation",
        timestamps: true,
        indexes: [
            {
                name: 'idx_spotId',
                fields: ['spotId']
            }
        ]
    })


module.exports = {
    ParkingReservation
}
