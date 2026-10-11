
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 夏令营订单表
const campOrders = sequelize.define("campOrders", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '订单标题',
    },
    // 订单号
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
    // 联系电话（下单人）
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '联系电话',
    },
    // 夏令营票ID
    ticketId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: '关联夏令营票ID',
    },
    // 营地ID
    campsiteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联营地ID',
    },
    // 场次ID
    sessionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: '关联场次ID',
    },
    // 开始日期
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '开营日期',
    },
    // 结束日期
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '结营日期',
    },
    // 人数（与营员明细表 campOrderParticipants 记录数一致）
    peopleCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '报名人数',
    },
    // 订单总额
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '订单总额',
    },
    // 优惠金额
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '优惠金额',
    },
    // 实付金额
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '实付金额',
    },
    // 支付方式
    payMethod: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1,
        comment: '支付方式 1:微信支付 2:支付宝 3:现金 4:银行转账',
    },
    // 支付状态
    payStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '支付状态 1:待支付 2:已支付 3:已退款',
    },
    // 订单状态
    orderStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '订单状态 1:待确认 2:已确认 3:已参加 4:已取消 5:已完成',
    },
    // 备注
    remark: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注信息',
    },
    // 取消原因
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '取消原因',
    },

}, {
    tableName: "campOrders",
    timestamps: true,
    indexes: [
        {
            name: "inx_id",
            fields: ["id"]
        },
        {
            name: "inx_orderNo",
            fields: ["orderNumber"]
        }
    ]
})

module.exports = {
    campOrders
}
