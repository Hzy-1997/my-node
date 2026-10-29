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
        comment: "反馈分类",
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
}, {
    timestamps: true,
})



module.exports = {
    opinionsFeedback,
}