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


const RoomType = sequelize.define('roomType', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '房间类型ID'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '房间类型名称'
    },
    roomDescription: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '房间里设施描述' 
    },
    // baseprice: {
    //     type: DataTypes.DECIMAL(10, 2), 
    //     allowNull: true,
    //     comment: '基础价格（用于显示参考价）'
    // },

    stock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '房间库存'
    },

    // remainingStock: {
    //     type: DataTypes.INTEGER,
    //     allowNull: true,
    //     comment: '剩余房间库存'
    // },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '房间类型描述'
    },
    facilities: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '房间设施（JSON格式）'
    },
    image: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '房间图片（JSON格式）'
    },
    banner: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '房间轮播（JSON格式）'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1-启用，2-禁用'
    },
    hotelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联酒店ID',
        references: {
            model: 'hotels',
            key: 'id'
        }
    },
    isBuyable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否可购买'
    },
}, {
    tableName: 'room_types',
    timestamps: true,
    underscored: true
});


module.exports = {
    RoomType
};