const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');




const Hotel = sequelize.define("hotel", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '酒店名称'
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '酒店地址'
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '经纬度'
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系电话'
    },
    star_rating: {
        type: DataTypes.TINYINT,
        allowNull: true,
        comment: '星级（1-5）'
    },
    intro: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '酒店简介'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1,
        comment: '酒店状态1-启用2-禁用',
    },
    tags: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '酒店标签'
    },
    feature: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '酒店特色'
    },
    images: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '酒店图片'
    },
    banner: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '酒店轮播图'
    },
    openingTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '开业时间'
    },
    facilities: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '酒店设施'
    },
    policies: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '酒店政策'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '酒店须知'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        comment: '创建时间'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        comment: '更新时间'
    }
}, {
    tableName: 'hotels',
    timestamps: false,
    underscored: true
});




module.exports = {
    Hotel
};






