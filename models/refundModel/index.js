/*
 * @描述: 退款单模型
 * @版本: 1.0
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index")

const RefundOrder = sequelize.define("RefundOrder", {
    // 退款单号（主键）
    refundNo: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        comment: '退款单号，唯一标识'
    },
    // 原订单号
    orderNo: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '关联的订单号（票务订单或套餐订单）'
    },
    // 用户手机号
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '申请退款的用手机号'
    },
    // 退款金额
    refundAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: '退款金额（元）'
    },
    // 票务ID
    ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '票务ID'
    },
    // 票务名称
    ticketName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '票务名称'
    },
    // 退款原因
    refundReason: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '退款原因'
    },
    // 退款状态
    refundStatus: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '退款状态：1-退款成功，2-退款失败，3-拒绝退款',
        validate: {
            isIn: [[1, 2, 3]],
        },
    },
    // 退款类型
    refundType: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '退款类型：1-全额退款，2-部分退款，3-未退款',
        validate: {
            isIn: [[1, 2, 3]],
        },
    },

    // 审核人名称
    auditorName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '审核人名称'
    },
    // 审核时间
    auditTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '审核时间'
    },
    // 订单类型：1-票务,2-套餐,3-酒店（用于退款列表按来源筛选）
    orderType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '订单类型：1-票务,2-套餐,3-酒店'
    },
}, {
    tableName: 'refund_orders',
    timestamps: true,
    comment: '退款单表',
    indexes: [ // 索引
        {
            fields: ['orderNo'],
            name: 'idx_order_no'
        },
        {
            fields: ['userPhone'],
            name: 'idx_user_phone'
        },
        {
            fields: ['refundStatus'],
            name: 'idx_refund_status'
        },
        {
            fields: ['createdAt'],
            name: 'idx_created_at'
        }
    ],
    comment: '退款单表'
})


module.exports = {
    RefundOrder
}
