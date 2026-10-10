
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const PriceRule = sequelize.define('price_rules', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    // 关联票务ID
    ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'ticket_id',
        references: {
            model: 'tickets',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: '关联票务ID'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'start_date',
        comment: '规则开始日期'
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'end_date',
        comment: '规则结束日期'
    },

    // 规则配置（JSON格式存储要执行的规则和价格）
    ruleConfig: {
        type: DataTypes.JSON,
        allowNull: false,
        field: 'rule_config',
        comment: '规则配置：{"weekday":{"priceType":2,"priceValue":80},"weekend":{"priceType":1,"priceValue":150},"holiday":{"priceType":1,"priceValue":200}}'
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '库存'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]]
        },
        comment: '状态(1:启用,2:禁用)'
    },
}, {
    tableName: 'price_rules',
    timestamps: true,
    indexes: [ 
        {
            name: 'idx_ticket_id',
            fields: ['ticket_id']
        },
        {
            name: 'idx_start_end_date',
            fields: ['start_date', 'end_date']
        },
        {
            name: 'idx_status',
            fields: ['status']
        }
    ]
});


module.exports = {
    PriceRule
};