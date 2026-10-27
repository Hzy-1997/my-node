
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 停车场表
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
    // 订单状态（统一五态，原独立 status 预约状态字段已废弃删除）
    // 停车业务特殊性：支付成功即视为核销完成 → payStatus 1:待支付 → 3:已完成（跳过 2:已支付）；
    // 用不用都不能退，仅管理员可强制退款 → 4:已退款；超时未支付/时段结束未支付 → 5:已取消（记录 cancelReason）
    payStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '订单状态：1-待支付 2-已支付(停车业务不使用) 3-已完成 4-已退款 5-已取消',
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
