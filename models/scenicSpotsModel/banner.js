/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');


const Banner = sequelize.define('Banner', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    positionCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '位置编码 (如: HOME_BANNER, PERFORMANCE_BANNER)',
        validate: {
            notEmpty: true
        }
    },
    title: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '标题/备注 (方便后台识别)'
    },
    imageUrl: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '图片地址',
    },
    jumpType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '跳转类型: 1-无跳转, 2-小程序页面, 3-外部H5, 4-特定业务ID'
    },
    jumpUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '跳转链接或页面路径'
    },
    sort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序号 (建议数字越大越靠前)'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态: 1-启用, 0-禁用'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '生效开始时间'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '生效结束时间'
    }
}, {
    timestamps: true, // 自动生成 createdAt 和 updatedAt
    comment: '统一轮播图管理表',
    indexes: [
        {
            name: 'idx_position_code',
            fields: ['positionCode']
        },
        {
            fields: ['status']
        },
        {
            name: 'idx_time_range',
            fields: ['startTime', 'endTime']
        }
    ]
});

module.exports = {
    Banner
};