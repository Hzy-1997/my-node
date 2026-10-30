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

const touristServices = sequelize.define("touristServices", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
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