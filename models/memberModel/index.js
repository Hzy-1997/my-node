/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index")

const Member = sequelize.define('Member', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // 姓名
    userName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // 昵称
    nickName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 用户编号
    openld: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // 用户头像
    avatar: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 手机号
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 证件类型 1:身份证 2:护照 3:驾驶证 4:其他
    idCardType: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3, 4]],
        },
    },
    // 身份证
    idCard: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 性别
    sex: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        validate: {
            isIn: [[1, 2, 3]],  // 1:男 2:女 3:未知
        },
    },
    // 邮箱
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 车牌号
    licensePlate: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 会员卡号
    memberCardNo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 会员等级 1-6级
    memberLevel: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3, 4, 5, 6]],
        },
    },
    // 会员卡类型
    memberCardType: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 所在地区
    region: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 添加三个备用字段
    // 备用字段1
    backupField1: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 备用字段2
    backupField2: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 备用字段3
    backupField3: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'members',
    timestamps: true,
})




module.exports = {
    Member
}