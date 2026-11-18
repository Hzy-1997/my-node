const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');


const Performance = sequelize.define('Performance', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '名称 (必填)'
    },
    subtitle: {
        type: DataTypes.STRING(100),
        comment: '副标题/卖点'
    },
    guide: {
        type: DataTypes.STRING(50),
        comment: '导语'
    },
    suitableCrowd: {
        type: DataTypes.JSON,
        comment: '适合人群'
    },
    performanceTypes: {
        type: DataTypes.JSON,
        comment: '演出类型'
    },
    tags: {
        type: DataTypes.JSON,
        comment: '内容标签'
    },
    capacity: {
        type: DataTypes.INTEGER,
        comment: '可容纳人数'
    },
    isReservationRequired: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否预约'
    },
    showTimes: {
        type: DataTypes.JSON,
        comment: '演出时间'
    },
    weekDays: {
        type: DataTypes.JSON,
        comment: '演出星期'
    },
    recommendIndex: {
        type: DataTypes.INTEGER,
        comment: '推荐指数',
    },
    audioUrl: {
        type: DataTypes.STRING(255),
        comment: '音频文件路径'
    },
    videoUrl: {
        type: DataTypes.STRING(255),
        comment: '视频文件路径'
    },
    coverImage: {
        type: DataTypes.STRING(255),
        comment: '封面图片路径'
    },
    carouselImages: {
        type: DataTypes.JSON,
        comment: '轮播图'
    },
    introduction: {
        type: DataTypes.TEXT,
        comment: '演艺介绍'
    },
    notice: {
        type: DataTypes.TEXT,
        comment: '注意事项'
    },
    duration: {
        type: DataTypes.STRING(50),
        comment: '表演时长'
    },
    suitableAge: {
        type: DataTypes.STRING(50),
        comment: '适合年龄'
    },
    coordinates: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '经纬度'
    },
    locationDesc: {
        type: DataTypes.STRING(255),
        comment: '位置描述'
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '状态 1:正常 2:停用'
    },
    isSmartRecommended: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否智能推荐'
    },
    isHotSpot: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否热点点位'
    },
    sort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序权重'
    },
    creatorId: {
        type: DataTypes.INTEGER,
        comment: '创建人ID'
    }
}, {
    tableName: 'performances',
    timestamps: true,
    // paranoid: true, // 开启软删除，自动生成 deletedAt
    comment: '演艺演出表'
});


module.exports = {
    Performance
};

