const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const PackageOrderDetail = sequelize.define('package_order_details', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '订单标题',
    },
    orderNumber: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: '订单号（独立，不再关联orders表）'
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '用户ID'
    },
    userName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '用户姓名'
    },
    userPhone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: '用户电话'
    },
    buyNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '购买数量'
    },
    orderStatus: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: '订单状态：1-待支付 2-待核销 3-已取消 4-已完成 5-已退款'
    },
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: '订单金额'
    },
    refundAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        comment: '退款金额'
    },
    alipayTradeNo: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: '支付宝交易号'
    },
    paymentTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '支付时间'
    },
    packageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '套餐ID'
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '用户选择的分组ID（对应package_items.groupId）'
    },
    isPrimary: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        comment: '是否主产品：1=主产品 0=附带品'
    },
    itemType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '子项类型：1=酒店房型 2=门票'
    },
    roomPackageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '关联酒店房型套餐ID（itemType=1时）',
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
        comment: '关联门票ID（itemType=2时）',
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
        comment: '关联门票价格规则ID（itemType=2时）',
        references: {
            model: 'price_rules',
            key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    itemName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '显示名称'
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '数量'
    },
    unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '单价'
    },
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '总价'
    },
    useDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '使用日期'
    },
    useEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '使用结束日期（酒店离店日期）'
    },
    verifyCode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: '核销码（唯一）'
    },
    verifyStatus: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '核销状态：1=未核销 2=已核销'
    },
    verifyTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '核销时间'
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '说明'
    }
}, {
    tableName: 'package_order_details',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_order_number',
            fields: ['order_number']
        },
        {
            name: 'idx_verify_code',
            fields: ['verify_code'],
            unique: true
        },
        {
            name: 'idx_package_id',
            fields: ['package_id']
        },
        {
            name: 'idx_group_id',
            fields: ['package_id', 'group_id']
        },
        {
            name: 'idx_room_package',
            fields: ['room_package_id']
        },
        {
            name: 'idx_ticket',
            fields: ['ticket_id']
        }
    ]
});

module.exports = {
    PackageOrderDetail
};
