/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index")

const Seat = sequelize.define("Seat", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // 座位号
    seatNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    // 状态
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        },
    },
    // 创建者
    createBy: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // 座位数量
    total: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    // 禁用数量
    disable: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    // 行数
    rows: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    },
    // 列数
    cols: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    },
    //座位名称
    seatName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // 座位
    seats: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    // 已预订座位
    blockedSeats: {
        type: DataTypes.JSON,
        allowNull: false,
    }
}, {
    tableName: 'seats',
    timestamps: true,
})

module.exports = {
    Seat
}