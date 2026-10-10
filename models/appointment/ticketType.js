/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

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
    dateTier: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "日期档次配置，包含有效期范围等",
    },
    activityDates: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "活动日期，支持多个日期或日期范围",
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
    totalInventory: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "该票档总库存（0表示不限）",
    },
    soldCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "已售数量",
    },
    sellableCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "可售数量（0表示不限）",
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