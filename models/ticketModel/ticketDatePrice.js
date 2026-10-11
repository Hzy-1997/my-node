const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 票务每日价格模型
const TicketDatePrice = sequelize.define('ticket_date_price', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '每日价格ID'
    },
    priceRuleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联价格规则ID',
        references: {
            model: 'price_rules',
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '日期'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '当日价格'
    },
    priceType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1, // 1-规则价格，2-手动价格
        comment: '价格类型'
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '当日库存'
    },
    soldStock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '已售库存'
    },
    availableStock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '可售库存'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1-启用，2-禁用'
    },
}, {
    tableName: 'ticket_date_prices',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_price_rule_id',
            fields: ['price_rule_id']
        },
        {
            name: 'idx_date',
            fields: ['date']
        },
        {
            name: 'idx_price_rule_date',
            fields: ['price_rule_id', 'date'],
            unique: true
        }
    ]
});

module.exports = {
    TicketDatePrice
};
