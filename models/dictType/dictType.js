
const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const DictCategory = sequelize.define("DictCategory", {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    dictName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "字典名称",
    },
    dictType: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: "字典类型",
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: "状态",
    },
    remark: {
        type: DataTypes.STRING(500),
        comment: "备注",
    },
}, {
    timestamps: true,  
});



const DictData = sequelize.define("DictData", {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    dictType: {
        type: DataTypes.STRING(100),
        comment: "字典类型",
    },
    dictLabel: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "字典标签",
    },
    dictValue: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "字典值",
    },
    dictSort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: "字典排序",
    },
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: "状态",
    },
    remark: {
        type: DataTypes.STRING(500),
        comment: "备注",
    },
},
    {
        // tableName: 'sys_dict_data',  // 自定义表名
        timestamps: true,
        // underscored: true  // 开启下划线命名法
    }
)
module.exports = {
    DictCategory,
    DictData
}