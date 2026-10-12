const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 景区公交订单车票明细（一票一码：每张票独立二维码、独立核销/退票状态）
const ScenicBusOrderTicket = sequelize.define('scenicBusOrderTicket', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // ========== 1. 关联订单 ==========
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联订单ID',
    },
    seq: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '票序号（订单内第几张）',
    },

    // ========== 2. 车票凭证 ==========
    ticketNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '车票号（每张票唯一）',
    },
    verifyCode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: '核销码（乘车二维码内容，每张票唯一）',
    },

    // ========== 3. 核销与退票 ==========
    verifyStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '票状态 1:待乘车 2:已核销 3:已过期 4:已退票',
    },
    verifyTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '核销时间',
    },
    verifiedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '核销操作人ID',
    },
    refundTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '退票时间',
    },
    ticketAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '该票实付金额（退款依据）',
    },
    refundAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: '该票退款金额',
    },
}, {
    tableName: 'scenicBusOrderTicket',
    timestamps: true,
    indexes: [
        {
            name: 'inx_orderId',
            fields: ['orderId']
        },
        {
            name: 'idx_ticketNo',
            fields: ['ticketNo'],
            unique: true
        },
        {
            name: 'idx_verifyCode',
            fields: ['verifyCode'],
            unique: true
        },
        {
            name: 'inx_verifyStatus',
            fields: ['verifyStatus']
        }
    ]
})

module.exports = {
    ScenicBusOrderTicket
}
