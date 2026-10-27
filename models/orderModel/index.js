/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index")

const Order = sequelize.define("Order", {
    // 订单号
    orderNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    // 票名称
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 订单类型
    orderType: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '订单类型：1-票务订单 2-套餐订单'
    },
    // 票种
    ticketType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 票价
    ticketPrice: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 会员ID
    memberId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'members',
            key: 'id',
        }
    },
    // 商品/票务ID
    goodsId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '商品/票务ID'
    },
    // 用户姓名
    userName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 用户电话
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 身份证号
    userIdCard: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 游玩日期
    playDate: {
        type: DataTypes.STRING,
        allowNull: true
    },
    //  座位
    seat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 购买数量
    buyNum: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 订单状态（统一五态：1-待支付 2-已支付 3-已完成 4-已退款 5-已取消）
    payStatus: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3, 4, 5]], // 1-待支付，2-已支付，3-已完成，4-已退款，5-已取消
        },
    },
    // 核销状态（1-待核销，2-已完成(已核销)，3-已过期(超使用期未核销)）
    verifyStatus: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3]], // 核销状态：1-待核销，2-已完成，3-已过期
        },
    },
    // 取消原因（payStatus=5 已取消时记录，如"超时未支付自动取消"）
    cancelReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '取消原因'
    },
    // 订单金额
    orderAmount: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 退款金额
    refundAmount: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '0'
    },
    // 支付宝交易号
    alipayTradeNo: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '支付宝交易号'
    },
    // 支付时间
    paymentTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '支付时间'
    }
}, {
    tableName: 'orders',
    timestamps: true,
    indexes: [
        {
            fields: ['orderNumber'],
            name: 'idx_order_number'
        }
    ]
})


module.exports = {
    Order
}