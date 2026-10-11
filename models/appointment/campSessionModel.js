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

// 营地预约
const CampSession = sequelize.define("CampSession", {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    campId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: "关联campsites.id",
    },
    sessionName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "场次名称，如：第七期",
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: "开始日期，如：2026-08-16",
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: "结束日期，如：2026-08-21",
    },
    totalInventory: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "该期总容量/可参加人数（0表示不限）",
    },
    soldCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "已售人数",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序，数值越小越靠前",
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: "1-可用 2-不可用",
    },
}, {
    tableName: "campSession",
    timestamps: true,
    indexes: [
        {
            name: "inx_id",
            fields: ["id"]
        }
    ]

});




module.exports = {
    CampSession
}