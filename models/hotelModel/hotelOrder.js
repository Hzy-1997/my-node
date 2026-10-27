/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');




const HotelOrder = sequelize.define('HotelOrder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    // 订单号
    orderNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '订单号',
    },
    // 用户id
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '用户id'
    },
    //用户电话
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '用户电话'
    },
    // 用户姓名
    userName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '用户姓名'
    },
    // 用户身份证号
    userCard: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '用户身份证号'
    },
    // 交易号
    transactionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '交易号'
    },
    // 房间id
    roomId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '房间id'
    },
    //房间名称
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '房间名称'
    },
    // 房型id（库存扣减维度）
    roomTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '房型id'
    },
    // 预订房间数
    roomCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '预订房间数'
    },
    // 入住时间
    checkInDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '入住时间'
    },
    // 离店时间
    checkOutDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '离店时间'
    },
    // 订单状态（统一五态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消）
    payStatus: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '订单状态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消'
    },
    // 取消原因（payStatus=5 已取消时记录）
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '取消原因'
    },
    // 订单金额
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: '订单金额'
    },
    refundAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: '退款金额'
    },
    // 交易号
    transactionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '交易号'
    },
    // 支付宝交易号（退款时调用支付宝必传）
    alipayTradeNo: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '支付宝交易号（退款必需）'
    },
    paymentTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '支付时间'
    },
    // 核销状态：1-待核销,2-已完成(已核销),3-已过期
    verifyStatus: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: '核销状态：1-待核销,2-已完成,3-已过期'
    },
    unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '单价'
    },
    totalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '总价'
    },
    verifyCode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: '核销码（唯一）'
    },
    verifyTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '核销时间'
    },
}, {
    tableName: 'hotel_order',
    comment: '酒店订单表',
    timestamps: true,
    indexes: [
        {
            name: 'idx_verifyCode',
            fields: ['verifyCode'],
            unique: true
        }
        ,
        {
            name: 'idx_transactionNumber',
            fields: ['transactionNumber'],
        },
        {
            name: 'idx_orderNumber',
            fields: ['orderNumber'],
        },
        {
            name: "idx_userPhone",
            fields: ['userPhone']
        },
        {
            name: "idx_payStatus",
            fields: ['payStatus'],
        }
    ]
})

module.exports = {
    HotelOrder
}