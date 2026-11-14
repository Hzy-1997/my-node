

const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 通用服务设施点位（卫生间、吸烟区等）
const ServiceFacility = sequelize.define("ServiceFacility", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "标题",
    },
    shortDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "简短描述",
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "地址",
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "经纬度位置",
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: "状态 (1: 正常, 2: 停用)",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序权重",
    }
}, {
    tableName: 'service_facility',
    timestamps: true,
}
)


module.exports = {
    ServiceFacility
}
