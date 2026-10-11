const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 景区公交订单模型
const ScenicBusOrder = sequelize.define('scenicBusOrder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // ========== 1. 订单标识 ==========
    orderNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '订单编号',
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '用户ID',
    },
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '联系电话',
    },
    contactName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系人姓名',
    },

    // ========== 2. 商品信息（下单时快照）==========
    scenicBusId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联景区公交ID',
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '标题快照',
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '首页图片快照',
    },
    ticketType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '票种快照：1-成人 2-儿童 3-学生 4-其他',
    },

    // ========== 3. 乘车信息 ==========
    rideDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '乘车日期（须在售卖日期区间内）',
    },
    timeSlot: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '乘车时段快照，如08:00-12:00',
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '购票数量',
    },

    // ========== 4. 金额信息 ==========
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '订单总额（单价×数量）',
    },
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '实付金额',
    },
    refundAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: '退款金额',
    },

    // ========== 5. 支付信息 ==========
    payMethod: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1,
        comment: '支付方式 1:微信支付 2:支付宝 3:现金 4:银行转账',
    },
    payStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '支付状态 1:待支付 2:已支付 3:已退款',
    },
    transactionNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '第三方交易号',
    },
    paymentTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '支付时间',
    },

    // ========== 6. 核销说明 ==========
    // 核销信息下沉到票明细表 scenicBusOrderTicket（一票一码）：
    // 支付成功后按 quantity 生成 N 条票记录，每张票独立二维码与核销状态；
    // 单张票可独立核销/退票（如用户A已乘车、用户B未乘车可单独退B的票）；
    // 全部票核销完成 → 订单流转为已完成，票的退款金额累计到订单 refundAmount。

    // ========== 7. 状态与备注 ==========
    orderStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '订单状态 1:待支付 2:待使用 3:已完成 4:已取消 5:已退款',
    },
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '取消原因',
    },
}, {
    tableName: 'scenicBusOrder',
    timestamps: true,
    indexes: [
        {
            name: 'inx_id',
            fields: ['id']
        },
        {
            name: 'inx_orderNumber',
            fields: ['orderNumber']
        },
        {
            name: 'inx_userId',
            fields: ['userId']
        },
        {
            name: 'inx_scenicBusId',
            fields: ['scenicBusId']
        },
        {
            name: 'inx_rideDate',
            fields: ['rideDate']
        }
    ]
})

module.exports = {
    ScenicBusOrder
}
