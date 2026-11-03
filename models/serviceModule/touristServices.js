
const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const touristServices = sequelize.define("touristServices", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    //服务分类
    serviceType: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: "服务分类",
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "服务标题",
    },
    shortDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "简短描述",
    },
    picture: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "服务图片",
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "服务地址",
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "位置",
    },

    chargeStandard: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "收费标准",
    },
    // 注意事项
    notice: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "注意事项",
    },
    // 设施介绍
    facilityIntroduction: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "设施介绍",
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: "状态 (1: 正常, 2: 下架)",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序权重",
    }
}, {
    timestamps: true,
}
)


module.exports = {
    touristServices
}