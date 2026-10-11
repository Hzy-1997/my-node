/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 房间套餐模型
const RoomPackage = sequelize.define('room_package', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '套餐ID'
    },
    roomTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联房间类型ID',
        references: {
            model: 'room_types',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '套餐名称'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: '套餐价格'
    },
    includes: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '套餐包含内容'
    },
    exitRule: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '退订规则'
    },
    // 开始日期
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '开始日期'
    },
    // 结束日期
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '结束日期'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1-启用，2-禁用'
    },
}, {
    tableName: 'room_packages',
    timestamps: true,  // 自动添加 createdAt 和 updatedAt 字段
    underscored: true, // 下划线命名风格
    indexes: [
        {
            name: 'idx_room_type_id',
            fields: ['room_type_id']
        }
    ]
});



module.exports = {
    RoomPackage
};