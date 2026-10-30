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

const opinionsFeedback = sequelize.define("opinionsFeedback", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
    },
    openld: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "用户ID",
    },
    type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "反馈分类  ['功能异常', '优化建议', '体验反馈', '景区问题', '其他问题']",
    },
    content: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "反馈内容",
    },
    //图片
    iamges: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: "反馈图片"
    },
    userNmae: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "用户名",
    },
    userPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "手机号",
    },
    userEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "邮箱",
    },
    isHandle: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: "是否处理 (1: 未处理, 2: 已处理)",
    },
    isView: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: "是否查看 (1: 未查看, 2: 已查看)",
    }


}, {
    timestamps: true,
})



module.exports = {
    opinionsFeedback,
}