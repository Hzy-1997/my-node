const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 景区公交预约模型
const ScenicBus = sequelize.define('scenicBus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    // ========== 1. 标识信息 ==========
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '标题',
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "首页图片",
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '开始售卖日期',
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '结束售卖日期',
    },
    ticketType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '票种：1-成人 2-儿童 3-学生 4-其他',
    },
    timeSlot: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '时段:08:00-12:00',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "详细介绍",
    },

    // ========== 2. 价格信息 ==========
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: '售价（实付单价）',
    },
    originalPrice: {                // 原价（划线价，做活动用）
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '原价（划线价，做活动用）',
    },

    // ========== 3. 库存信息 ==========
    totalStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '总放票量',
    },
    // ========== 4. 状态与排序 ==========
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: '状态 1:上线 2:下线',
    },
    sort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序',
    },
})

module.exports = {
    ScenicBus
}