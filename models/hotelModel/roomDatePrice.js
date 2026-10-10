const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 每日价格模型
const RoomDatePrice = sequelize.define('room_date_price', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '每日价格ID'
    },
    roomPackageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联套餐ID',
        references: {
            model: 'room_packages',
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
    tableName: 'room_date_prices',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_room_package_id',
            fields: ['room_package_id']
        },
        {
            name: 'idx_date',
            fields: ['date']
        },
        {
            name: 'idx_room_package_date',
            fields: ['room_package_id', 'date'],
            unique: true
        }
    ]
});



module.exports = {
    RoomDatePrice
};