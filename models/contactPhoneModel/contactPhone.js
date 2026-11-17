/*
 * @描述: 联系电话表
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const contactPhone = sequelize.define("contactPhone", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    // 电话名称（如：景区咨询、投诉建议、紧急救援、失物招领）
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "电话名称",
    },
    // 电话号码
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "电话号码",
    },
    // 电话分类 (1: 咨询服务, 2: 投诉建议, 3: 紧急救援, 4: 其他)
    type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: "电话分类 (1: 咨询服务, 2: 投诉建议, 3: 紧急救援, 4: 其他)",
    },
    // 归属区域（如：光雾山景区、米仓山景区、全域）
    area: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "归属区域",
    },
    // 描述说明（如：服务时间 8:00-18:00）
    description: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "描述说明",
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: "状态 (1: 正常, 2: 停用)",
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "排序权重",
    }
}, {
    timestamps: true,
})



module.exports = {
    contactPhone,
}
