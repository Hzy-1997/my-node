/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-25 09:17:19
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-11-08 15:38:44
 */

const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

// 创建 Role 模型
const Role = sequelize.define('Role', {
    // 定义模型属性
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // 定义角色名称
    roleName: {
        type: DataTypes.STRING,
        allowNull: false,
    },



    // 定义角色备注
    remark: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // 角色状态
    status: {
        type: DataTypes.INTEGER,
        allowNull: false,  // 不能为空
        defaultValue: 1, // 默认为1，表示启用
        validate: {
            isIn: [[1, 2]],   // 只允许1和2
        },
    },

    // 角色排序
    sort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // 默认为0
    }
}, {
    tableName: 'roles',
    timestamps: true,
    updatedAt: true,
});





// 创建 UserRole 模型，建立 User 和 Role 的多对多关系
const UserRole = sequelize.define('UserRole', {
}, {
    tableName: 'user_roles',
    timestamps: false,
});

// 建立 MenuRole 模型，建立 Role 和 Menu 的多对多关系
const MenuRole = sequelize.define('MenuRole', {}, {
    tableName: 'menu_roles',
    timestamps: false,
});

module.exports = {
    Role,
    UserRole,
    MenuRole
}

