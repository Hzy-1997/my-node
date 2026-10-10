const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 定义操作日志模型
const OperLog = sequelize.define(
    "OperLog",
    {
        // 操作ID（主键）
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        // 操作标题/模块名称
        title: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: '操作标题/模块名称'
        },
        // 业务类型（如：增删改查）
        businessType: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '业务类型（如：增删改查）'
        },
        // 方法名称
        method: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: '方法名称'
        },
        // 请求方式（GET/POST/PUT/DELETE）
        requestMethod: {
            type: DataTypes.STRING(10),
            allowNull: true,
            comment: '请求方式（GET/POST/PUT/DELETE）'
        },
        // 操作人员类型（如：管理员/普通用户）
        operatorType: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: '操作人员类型（如：管理员/普通用户）'
        },
        // 操作人员姓名
        operatorName: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '操作人员姓名'
        },
        // 部门名称
        deptName: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '部门名称'
        },
        // 操作URL地址
        operUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: '操作URL地址'
        },
        // 操作者IP地址
        operIp: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '操作者IP地址'
        },
        // 操作地点
        operLocation: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: '操作地点'
        },
        // 操作参数（请求参数）
        operParam: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: '操作参数（请求参数）'
        },
        // 返回结果（JSON格式）
        jsonResult: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: '返回结果（JSON格式）'
        },
        // 操作状态（0-成功，1-失败）
        status: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: '操作状态（0-成功，1-失败）'
        },
        // 错误信息
        errorMsg: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: '错误信息'
        },
        // 操作时间
        operTime: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '操作时间'
        },
        // 耗时（毫秒）
        costTime: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '耗时（毫秒）'
        }
    },
    {
        tableName: "oper_logs",
        timestamps: true,
        updatedAt: true,
        underscored: true,
    }
);

module.exports = {
    OperLog
};
