/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
// 营地预约
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

const Campsite = sequelize.define("Campsite", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "夏令营名称"
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "价格"
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "描述"
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "首页图片"
    },
    carouselImages: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "轮播图片"
    },
    businessHours: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "营业时间（如：08:30-22:00）",
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '标签列表）',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "详细介绍",
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
    locationLink: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "位置链接",
    },
    activityDates: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: "活动日期列表",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "排序",
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: "1-可用 2-不可用",
    }

}, {
    tableName: "campsites",
    timestamps: true,
    indexes: [
        {
            name: "idx_id",
            fields: ["id"]
        },
        {
            name: 'idx_status',
            fields: ['status']
        }
    ]
})

module.exports = {
    Campsite
}