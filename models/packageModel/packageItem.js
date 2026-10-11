const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const PackageItem = sequelize.define('package_items', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    packageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联套餐主表ID',
        references: {
            model: 'product_packages',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '分组ID：同一groupId下有1个主产品(isPrimary=1)和若干附带品(isPrimary=0)，用户下单时选一个组'
    },
    isPrimary: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        comment: '是否主产品：1=主产品（每组1个） 0=附带品'
    },
    itemType: {
        type: DataTypes.TINYINT,
        allowNull: false, // 必填
        defaultValue: 1,
        comment: '子项类型：1=酒店 2=门票 3=其他'
    },
    roomPackageId: {
        type: DataTypes.INTEGER,
        allowNull: true, // 可选
        comment: '关联酒店房型套餐ID（itemType=1时必填）',
        references: {
            model: 'room_packages',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '关联门票ID（itemType=2时必填）',
        references: {
            model: 'tickets',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    ticketPriceRuleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '关联门票价格规则ID（itemType=2时必填），用于查TicketDatePrice库存',
        references: {
            model: 'price_rules',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '售卖开始日期'
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '售卖结束日期'
    },
    maxSaleNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '总限量（0=不限量）'
    },
    maxBuyNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '每单限购（0=不限量）'
    },
    soldStock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '已售库存'
    },
    availableStock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '可售库存'
    },
    itemName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '显示名称（冗余，如"豪华大床房"）'
    },
    quantity: {
        type: DataTypes.INTEGER, //
        allowNull: false,
        defaultValue: 1,
        comment: '包含数量'
    },
    originalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '原价'
    },
    unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '优惠价'
    },
    useDateType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '使用日期类型：1=跟随主产品入住日期 2=跟随主产品游玩日期 3=固定日期 4=购买后N天内'
    },
    useDateOffset: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '日期偏移天数（仅useDateType=1时有效）'
    },
    useDateValue: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '日期值（固定日期或N天）'
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '权益描述'
    },
    icon: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '权益图标标识'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1=正常 2=删除'
    },

}, {
    tableName: 'package_items',
    timestamps: true,
    underscored: false,
    indexes: [
        {
            name: 'idx_package_id',
            fields: ['packageId']
        },
        {
            name: 'idx_group_id',
            fields: ['packageId', 'groupId']
        },
        {
            name: 'idx_room_package',
            fields: ['roomPackageId']
        },
        {
            name: 'idx_ticket',
            fields: ['ticketId']
        },
        {
            name: 'idx_ticket_price_rule',
            fields: ['ticketPriceRuleId']
        },
        {
            name: 'idx_primary',
            fields: ['packageId', 'isPrimary']
        }
    ]
});

module.exports = {
    PackageItem
};
