/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

const Reminder = sequelize.define('reminder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '用户ID'
    },
    // 项目ID
    projectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '项目ID'
    },
    // 是否预约
    isAppointment: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '是否预约 1-否,2-是'
    },
    // 项目开始时间 冗余存一份
    projectStartTime: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '项目开始时间'
    },
    reminderType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '提醒类型'
    },
    reminderTime: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '提醒时间'
    },

    //提醒提醒时机
    reminderTimeType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '提醒提醒时机'
    },

    reminderContent: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '提醒内容'
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: '状态:1-待发送,2-已发送,3-失败',
        validate: {
            isIn: [[1, 2, 3]],
        },
    },
}, {
    timestamps: true, // 自动创建createdAt和updatedAt字段   
});



module.exports = {
    Reminder
}