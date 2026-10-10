
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index"); // 导入已连接的 Sequelize 实例

// 定义 User 模型（也就是数据库表）
const User = sequelize.define(
    "User",
    {
        // 定义字段
        id: {
            type: DataTypes.INTEGER, // 字段类型
            primaryKey: true, // 设置为主键
            autoIncrement: true, // 自增
        },

        // 用户名
        username: {
            type: DataTypes.STRING,
            allowNull: false, // 不允许为空
        },
        // 邮箱
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, // 唯一
        },
        // 账号
        account: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        // 密码
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        //手机号
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true, // 确保用户名唯一
        },
        //岗位
        job: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // 状态
        status: {
            type: DataTypes.INTEGER,
            defaultValue: 2, // 默认值为2
        },
        // 账户状态
        accountStatus: {
            type: DataTypes.INTEGER,
            defaultValue: 1, // 默认值为1
        },
        // 性别
        sex: {
            type: DataTypes.INTEGER,
            defaultValue: 2, // 默认值为2
        },
        //头像
        avatar: {
            type: DataTypes.STRING,
        },
        // 部门ID，外键关联到部门表
        deptId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Dept', // 使用正确的模型名称（单数形式）
                key: 'id'
            },
            comment: '所属部门ID'
        }
    },
    // 其他选项
    {
        tableName: "users", // 指定表名，如果不指定，Sequelize 会自动使用模型名称的小写复数形式
        timestamps: true, // 自动创建 createdAt 和 updatedAt 字段
        updatedAt: true, // 确保自动更新时间
    }
);

module.exports = {
    User
};
