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


const Dept = sequelize.define('Dept', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    deptName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    // 使用外键关联到用户表，替代原有的userId, userName, userEmail
    leaderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'User',
            key: 'id'
        },
        comment: '部门负责人ID'
    },

    sort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序序号，用于前端展示顺序'
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '部门状态:1-启用2-禁用'
    }
}, {
    tableName: 'depts',
    timestamps: true,
    updatedAt: true,
});


// 关联的子表
const DeptParent = sequelize.define('DeptParent', {

    childId: {
        type: DataTypes.INTEGER,
        references: { model: Dept, key: 'id' }
    },
    parentId: {
        type: DataTypes.INTEGER,
        references: { model: Dept, key: 'id' }
    }
}, {
    tableName: 'dept_parents',
    timestamps: false,
    indexes: [{
        unique: true,
        fields: ['childId', 'parentId']
    }]
});

module.exports = {
    Dept,
    DeptParent
};