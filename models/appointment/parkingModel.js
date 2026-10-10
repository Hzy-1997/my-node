// 停车预约模型
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");


const Parking = sequelize.define("Parking", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "停车场名称",
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '标签列表（如：["停车场", "停车服务", "停车优惠]）',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "详细介绍",
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "首页图片",
    },
    carouselImages: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: "轮播图列表",
    },
    businessHours: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "营业时间（如：08:30-22:00）",
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "联系电话",
    },
    locationDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "位置描述（如：北京市海淀区）",
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: "预约价格",
    },
    availableCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "可预约数量",
    },
    locationLink: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "位置链接",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序权重",
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]]
        },
        comment: '状态(1:待处理,2:已处理)'
    },
}, {
    tableName: 'parkings',
    timestamps: true,
    indexes: [
        {
            name: "id",
            fields: ["id"]
        },
        {
            name: 'idx_status',
            fields: ['status']
        }
    ]
});


module.exports = {
    Parking,
}