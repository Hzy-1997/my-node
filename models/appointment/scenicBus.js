const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

// 景区公交预约模型
const ScenicBus = sequelize.define('scenicBus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    // ========== 1. 标识信息 ==========
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '线路名',
    },
    ticketDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '使用日期',
    },
    ticketType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '票种：1-成人 2-儿童 ', 
    },
    timeSlot: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '时段:08:00-12:00',
    },

    // ========== 2. 价格信息 ==========
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: '售价（实付单价）',
    },
    originalPrice: {                // 原价（划线价，做活动用）
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '原价（划线价，做活动用）',
    },
    routeCode: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '核销码',
    },

    // ========== 3. 库存信息 ==========
    totalStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '总放票量',
    },
    soldCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '已售（含待支付锁定）',
    },
    lockedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '待支付锁定数（可选，见下方说明）',
    },
    per_user_limit: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '每人限购（0=不限）',
    },

    // ========== 4. 状态与排序 ==========
    status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        comment: '状态 1:上线 2:下线',
    },
    sort: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序',
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注信息',
    }
})