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


const Popup = sequelize.define('Popup', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    positionCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'HOME_POPUP',
        comment: '位置编码 (如: HOME_POPUP)'
    },
    title: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '弹窗名称/备注'
    },
    imageUrl: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: '弹窗图片地址'
    },
    jumpType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '跳转类型: 1-无跳转, 2-小程序页面, 3-外部H5'
    },
    jumpUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '跳转链接或页面路径'
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
        comment: '活动生效开始时间'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '活动生效结束时间'
    }
}, {
    timestamps: true,
    comment: '统一弹窗管理表',
    indexes: [
        {
            name: 'idx_position_code',
            fields: ['positionCode']
        },
        {
            name: 'idx_time_range',
            fields: ['startTime', 'endTime']
        }
    ]
});



module.exports = {
    Popup
}