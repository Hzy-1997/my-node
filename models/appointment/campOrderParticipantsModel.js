/*
 * @描述: 夏令营订单营员明细表 Model
 * @版本: 1.0
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 夏令营订单营员明细表（一单多人，每个营员一条记录）
const campOrderParticipants = sequelize.define("campOrderParticipants", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联订单ID',
    },

    camperName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '营员姓名',
    },

    camperGender: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '营员性别 1:男 2:女',
    },

    camperAge: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '营员年龄',
    },

    idType: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1,
        comment: '证件类型 1:身份证 2:护照 3:其他',
    },

    idCard: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '营员证件号',
    },

    height: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: '身高(cm)',
    },

    weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: '体重(kg)',
    },

    way: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '来营方式',
    },
    // 营种类别 / 技能特长 (新增，对应表单：请输入单板或双板)
    // 注：如果业务上“营种类别”和“技能特长”是两个不同的概念，建议拆成两个字段
    campCategory: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '营种类别/技能特长，如单板、双板等',
    },

    notice: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '注意事项',
    },

    dietaryRestrictions: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '饮食禁忌',
    },

    parentPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '家长联系电话',
    },

    parentName: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '家长姓名',
    },

    parentWechat: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '家长微信号',
    },

    parentIdCard: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '家长身份证号',
    },

    shippingAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '快递地址（用于邮寄营后遗漏物品）',
    },

}, {
    tableName: "campOrderParticipants",
    timestamps: true,
    indexes: [
        {
            name: "inx_id",
            fields: ["id"]
        },
        {
            name: "inx_orderId",
            fields: ["orderId"]
        }
    ]
})

module.exports = {
    campOrderParticipants
}