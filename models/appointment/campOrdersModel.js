
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
    // 营员姓名
    camperName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '营员姓名',
    },
    // 营员性别
    camperGender: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '营员性别 1:男 2:女',
    },
    // 营员年龄
    camperAge: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '营员年龄',
    },
    // 身份证号
    idCard: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '营员身份证号',
    },
    // 联系电话
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '联系电话',
    },
    // 家长姓名
    parentName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '家长姓名',
    },
    // 家长联系电话
    parentPhone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '家长联系电话',
    },
    // 家长身份证号
    parentIdCard: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '家长身份证号',
    },
    // 夏令营票ID
    ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联夏令营票ID',
    },
    // 身高
    height: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: '身高',
    },
    // 体重
    weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: '体重',
    },
    // 来营方式
    way: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '来营方式',
    },
    // 注意事项
    notice: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '注意事项',
    },
    // 饮食禁忌
    dietaryRestrictions: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '饮食禁忌',
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
    // 人数
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
