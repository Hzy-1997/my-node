/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');


// 演出场次表：一行 = 某演出 · 某星期 · 某一场
// 场景映射：
//   一三五有        → 插 weekDay = 1/3/5 的行
//   只有周末        → 插 weekDay = 0/6 的行
//   一三五上午      → 1/3/5 × 09:00~12:00 各一行
//   每天十场        → 0~6 × 10 个时间 = 70 行
const PerformanceSchedule = sequelize.define('PerformanceSchedule', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键ID'
    },
    performanceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '演出ID，关联performances.id'
    },
    weekDay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '星期 0-6（0=周日，与JS Date.getDay()一致）'
    },
    showTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
        comment: '开演时间 HH:mm，如 09:00'
    },
    capacity: {
        type: DataTypes.INTEGER,
        comment: '该场次可容纳人数，为空则使用主表capacity'
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '状态 1:正常 2:停用（可单独停用某一场）'
    }
}, {
    tableName: 'performance_schedules',
    timestamps: true, 
    indexes: [
        {
            unique: true, 
            fields: ['performanceId', 'weekDay', 'showTime'],
            name: 'uk_performance_weekday_time'
        },
        {
            fields: ['weekDay', 'showTime'],
            name: 'idx_weekday_showtime'
        }
    ],
    comment: '演出场次表'
});


module.exports = {
    PerformanceSchedule
};
