const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 停车场车位模型
const ParkingSpot = sequelize.define("ParkingSpot", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    parkingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "所属停车场ID",
    },
    spotNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: "车位编号（如：B1-A03）",
    },
    area: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "区域/楼层（如：B1、地面A区）",
    },
    spotType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3, 4]]
        },
        comment: "车位类型(1:普通,2:充电桩,3:无障碍,4:大型车)",
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]]
        },
        comment: "状态(1:启用,2:停用维护)",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序权重",
    },
}, {
    tableName: 'parking_spots',
    timestamps: true,
    indexes: [
        {
            name: 'idx_parkingId',
            fields: ['parkingId']
        },
        {
            name: 'uk_parking_spot',
            unique: true,
            fields: ['parkingId', 'spotNumber']
        }
    ]
});


module.exports = {
    ParkingSpot,
}
