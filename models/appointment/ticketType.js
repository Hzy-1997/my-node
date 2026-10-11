
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");


// 夏令营票档
const TicketType = sequelize.define("TicketType", {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    campId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: "关联camp.id",
    },
    // 关联场次ID
    sessionId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: "关联场次ID",
    },

    ticketName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "票档名称，如：网球夏令营早鸟价（三人同行）",
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "总价（元）",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序",
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: "1-可用 2-不可用",
    },
}, {
    tableName: "ticket_type",
    timestamps: true,
});



module.exports = { TicketType };