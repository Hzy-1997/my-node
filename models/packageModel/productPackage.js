const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');

const ProductPackage = sequelize.define('product_packages', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '套餐名称'
    },
    subTitle: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '副标题/宣传语'
    },
    type: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '套餐类型：1=酒店套餐 2=游玩套餐 3=赛事套餐 4=自定义'
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '自定义分类标签'
    },
    coverImage: {
        type: DataTypes.STRING(500),
        allowNull: true,  
        comment: '封面图URL'
    },
    bannerImages: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '轮播图数组'
    },
    // marketPrice: {
    //     type: DataTypes.DECIMAL(10, 2),
    //     allowNull: false,
    //     defaultValue: 0.00,
    //     comment: '市场价（划线价）'
    // },
    // minPrice: {
    //     type: DataTypes.DECIMAL(10, 2),
    //     allowNull: false,
    //     defaultValue: 0.00,
    //     comment: '最低价（冗余）'
    // },
    // maxPrice: {
    //     type: DataTypes.DECIMAL(10, 2),
    //     allowNull: false,
    //     defaultValue: 0.00,
    //     comment: '最高价（冗余）'
    // },
    soldStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '已售份数'
    },

    saleMode: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '销售方式：1=独立售卖 2=必须搭配主产品'
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
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '标签数组'
    },
    includes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '套餐包含权益文本描述'
    },
    refundRule: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '退订规则说明'
    },
    useRule: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '使用规则说明'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排序权重'
    },
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1=上架 2=下架 3=售罄'
    }
}, {
    tableName: 'product_packages',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_type_status',
            fields: ['type', 'status']
        },
        {
            name: 'idx_category',
            fields: ['category']
        },
        {
            name: 'idx_date_range',
            fields: ['start_date', 'end_date']
        },
        {
            name: 'idx_sort',
            fields: ['sort_order']
        }
    ]
});

module.exports = {
    ProductPackage
};
