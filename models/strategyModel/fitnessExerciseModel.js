// 健身运动模型

const { DataTypes, Op } = require('sequelize'); // 引入sequelize
const { sequelize } = require('../../mysql/index'); // 引入sequelize实例


const FitnessExercise = sequelize.define('FitnessExercise', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },

    // ===== 基础信息 =====
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '标题（如：高尔夫专业练习场）'
    },
    subtitle: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
        comment: '1 自营 2 非自营 （默认自营）'
    },
    shortDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '简短描述（如：专业的滑雪户外品牌折扣店）'
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '标签列表（如：["高尔夫", "专业练习场"]）'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '详细介绍'
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '联系电话'
    },

    // ===== 图片 =====
    carouselImages: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '轮播图列表'
    },

    // ===== 场馆信息 =====
    facilities: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '配套设施（如：["高尔夫球", "高尔夫杆", "高尔夫球杆"]）'
    },
    locationDesc: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '位置描述（如：北京市海淀区）'
    },

    locationLink: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '位置链接'
    },

    // ===== 营业信息 =====
    businessHours: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '营业时间（如：09:00-16:30）'
    },

    // ===== 人群标签 =====
    suitableFor: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: '适用人群（如：["青少年", "成人"]）'
    },

    // ===== 其他辅助字段 =====
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序权重'
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '状态 // 1: 上线 2: 下线'
    }
});



module.exports = {
    FitnessExercise
}