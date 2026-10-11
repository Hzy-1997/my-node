// 餐饮模型

const { DataTypes, Op } = require('sequelize'); // 引入sequelize
const { sequelize } = require('../../mysql/index'); // 引入sequelize实例


const Restaurant = sequelize.define('Restaurant', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '餐厅名称（如：源膳）'
    },
    subtitle: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: '1 自营 2 非自营 （默认自营）'
    },
    shortDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '简短描述（如：循万豪品质，承湖湘本味）'
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '标签列表（如：["高尔夫", "专业练习场"]）'
    },

    avgPrice: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '人均消费'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '详细介绍'
    },
    carouselImages: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '轮播图列表'
    },
    businessHours: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '营业时间（如：早7:00-10:00 / 午12:00-14:00 / 晚17:30-21:00）'
    },
    locationDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '位置描述（如：北京市海淀区）'
    },
    locationLink: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '位置链接'
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系电话'
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: '1',
        comment: '状态 1=上架 2=下架'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序权重'
    }
});



module.exports = {
    Restaurant
}