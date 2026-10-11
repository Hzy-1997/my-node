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

const Strategy = sequelize.define('strategy', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // 策略名称
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // 封面图
    cover: {
        type: DataTypes.STRING,
        allowNull: false
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
    // 记录登记时间
    time: {
        type: DataTypes.JSON,
        allowNull: false, // 不允许为空
    },
    // 介绍内容
    content: {
        type: DataTypes.JSON,
    },
}, {
    tableName: 'strategys',
    timestamps: true,
})

module.exports = {
    Strategy
}