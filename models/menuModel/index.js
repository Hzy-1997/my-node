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
// 移除已注释的Permission导入，避免引用错误
// const { Permission } = require('../roleModel/index');

// 创建菜单模型（包含按钮）
const Menu = sequelize.define('Menu', {
    id: {
        type: DataTypes.INTEGER,  // 主键ID
        primaryKey: true, // 主键
        autoIncrement: true  // 自增
    },
    // 菜单/按钮名称
    menuName: {
        type: DataTypes.STRING,
        allowNull: false  // 非空 
    },
    // 层级：1-一级目录，2-二级菜单，3-按钮
    menuLevel: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            isIn: [[1, 2, 3]],
        },
    },
    // 路由地址
    path: {
        type: DataTypes.STRING,
    },
    // 菜单图标
    icon: {
        type: DataTypes.STRING,
    },
    // 组件地址
    component: {
        type: DataTypes.STRING,
    },
    // 描述
    description: {
        type: DataTypes.STRING,
    },
    // 状态：2 - 禁用，1 - 启用
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        },
    },
    // 排序
    sort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },

    // 父级ID
    parentId: {
        type: DataTypes.INTEGER,   //字段类型 为整数
        allowNull: true,  // 允许为空
        // 外键关联 - 引用 Menus 表的 id 字段
        references: {
            model: 'Menus', //  指定关联的模型名称为'Menus'
            key: 'id', //  指定关联的键为'id'
        },
    },
    // 类型：1-菜单，2-按钮
    type: {
        type: DataTypes.TINYINT,
        allowNull: false,
        validate: {
            isIn: [[1, 2, 3]],
        },
    },
    // 权限标识（仅按钮使用）
    permissionFlag: {
        type: DataTypes.STRING,
    },
}, {
    tableName: 'menus',
    timestamps: true,
});

module.exports = {
    Menu
};