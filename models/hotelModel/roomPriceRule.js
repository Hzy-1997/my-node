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

// 酒店价格规则模型
const RoomPriceRule = sequelize.define('room_price_rule', {

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '价格规则ID'
    },

    ruleConfig: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: '规则配置：{"weekday":{"priceType":2,"priceValue":80},"weekend":{"priceType":1,"priceValue":150},"holiday":{"priceType":1,"priceValue":200}}'
    },

    roomPackageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        comment: '关联套餐ID',
        references: {
            model: 'room_packages',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },

}, {
    tableName: 'room_price_rule',
    timestamps: true,
    underscored: true,

});

module.exports = {
    RoomPriceRule
};