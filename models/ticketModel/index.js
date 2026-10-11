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
const { holiday } = require("./holiday");
const { TicketDatePrice } = require('./ticketDatePrice');

const Ticket = sequelize.define('ticket', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // 名称
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: '名称'
    },
    // 票编号
    productCode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '票编号',
    },

    // 库存
    stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,          // 默认值为0
        validate: {
            isInt: true,          // 确保字段是整数
        },
        comment: '库存'
    },
    startTime: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '开始时间'
    },
    address: {
        type: DataTypes.STRING,
        comment: '演出地址'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2), // 支持小数，最多10位数字，其中2位小数
        allowNull: false, // 禁止为空
        defaultValue: 0.00,
        comment: '票价格'
    },
    discountPrice: {
        type: DataTypes.DECIMAL(10, 2), // 支持小数，最多10位数字，其中2位小数
        allowNull: true,
        defaultValue: 0.00,
        comment: '折扣价',
    },
    banners: {
        type: DataTypes.STRING,
        comment: '轮播图'
    },
    homeImg: {
        type: DataTypes.STRING,
        comment: '首页图'
    },
    category: {
        type: DataTypes.INTEGER,  // 确保字段是整数
        defaultValue: 1,
        allowNull: false, // 禁止为空
        comment: '分类'
    },
    ticketType: {
        type: DataTypes.INTEGER,  // 确保字段是整数
        defaultValue: 1,
        allowNull: false, // 禁止为空
        comment: '票种'
    },
    validTime: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '有效期'
    },
    // 演出时间
    showTime: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '演出时间'
    },
    // 演出时长
    showDuration: {
        type: DataTypes.STRING,
        comment: '演出时长'
    },
    // 演出简介
    showIntro: {
        type: DataTypes.JSON,
        comment: '演出简介'
    },
    soldCount: {
        type: DataTypes.INTEGER,
        allowNull: true, // 禁止为空
        defaultValue: 0,
        validate: {
            isInt: true,
        },
        comment: '已售数量'
    },
    // 剩余库存
    remainingStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            isInt: true,
        },
        comment: '剩余可售库存'
    },
    // 类型说明
    typeDescription: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    // 是否当天下单
    isToday: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        },
    },
    // 是否下架
    isDown: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        },
    },
    //是否需要选座
    isSeat: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        }
    },
    // 是否支持团购
    isGroup: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        }
    },
    // 是否支持退票
    isRefund: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        }
    },
    salePeriod: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 7,
        comment: '可售卖的未来天数，0表示无限制'
    },

    onlineTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '票务上线时间'
    },
    saleStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '售卖开始日期'
    },
    saleEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '售卖结束日期'
    },
    // 是否被推荐
    isRecommended: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2]],
        },
        comment: '是否被推荐：1-是，2-否'
    },
    // 关联座位表
    seatId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
            model: 'seats',
            key: 'id',
        }
    },
    // 票种可购买的最大数量，0表示无限购买
    maxPurchaseQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            isInt: true,
        },
        comment: '票种可购买的最大数量，0表示无限购买'
    },
    // 库存重置类型：0-不重置（预售/总库存模式），1-每日重置（日票模式）
    stockResetType: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            isIn: [[0, 1]],
        },
        comment: '库存重置类型：0-不重置（预售/总库存模式），1-每日重置（日票模式）'
    },
    // 会员等级限制可购
    memberLevel: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            isIn: [[1, 2, 3, 4, 5, 6]],
        },
        comment: '会员等级限制可购'
    }

}, {
    tableName: 'tickets',
    timestamps: true,
});

module.exports = {
    Ticket,
    holiday,
    TicketDatePrice
};