

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const holiday = sequelize.define("holidays", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // 今年的节假日
    thisYear: {
        type: DataTypes.TEXT,
        field: "this_year",
        allowNull: false,  //不允许为空
    },
    // 明年的节假日
    nextYear: {
        type: DataTypes.TEXT,
        field: "next_year",
        allowNull: false,  //不允许为空
    },
    // 用于年份判断
    year: {
        type: DataTypes.STRING,
        field: "year",
        allowNull: false,  //不允许为空
    }
}, {
    tableName: "holidays",
    timestamps: true,
});

module.exports = {
    holiday
}
