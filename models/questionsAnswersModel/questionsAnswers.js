const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');


//智能问答表
const QuestionsAnswers = sequelize.define('questionsAnswers', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['1', '2', '3', '4', '5', '6']],
        },
        comment: "问题分类，1-6分别代表6个分类"
    },
    question: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "问题内容"
    },
    answer: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "问题答案"
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['1', '2']],
        },
        comment: "1-禁用，2-启用"
    }
}, {
    timestamps: false,
})

module.exports = {
    QuestionsAnswers
};