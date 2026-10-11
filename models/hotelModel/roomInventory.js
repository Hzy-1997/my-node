const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 房型每日库存模型（房型共享库存，按 roomTypeId + date 唯一）
const RoomInventory = sequelize.define('roomInventory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '房型库存ID'
    },
    roomTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '房型ID',
        references: {
            model: 'room_types',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '日期'
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '当日总库存'
    },
    soldStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '已售库存数量'
    },
    availableStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '可用库存数量'
    }

}, {
    tableName: 'room_inventories',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            name: 'idx_room_type_date',
            fields: ['room_type_id', 'date'],
            unique: true
        }
    ]

})

module.exports = {
    RoomInventory
};
