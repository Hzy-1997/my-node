const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const WriteOff = sequelize.define('writeOff', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '核销员姓名',
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '核销员手机号',
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '核销状态：1-启用，2-停用',
    },
    todayWriteOff: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '今日核销次数',
    },
    lastWriteOffTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后一次核销时间',
    },
    operator: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '操作人',
    },
    // 核销员类型：1-票务,2-酒店（复用同一张表，按类型区分）
    type: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '核销员类型：1-票务,2-酒店',
    },
}, {
    tableName: 'write_offs',
    timestamps: true,
    underscored: true, // 使用下划线命名
}



);

module.exports = {
    WriteOff
};

