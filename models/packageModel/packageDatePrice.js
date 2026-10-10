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

const PackageDatePrice = sequelize.define('package_date_prices', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    packageItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联套餐项目ID（对应package_items.id）',
        references: {
            model: 'package_items',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: '日期'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '当日该分组的套餐价格'
    },
    priceType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '价格类型：1=默认价格 2=百分比上涨 3=百分比下降'
    },
    stock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '当日库存'
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
    status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1=启用 2=禁用'
    }
}, {
    tableName: 'package_date_prices',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_package_item',
            fields: ['package_item_id']
        },
        {
            name: 'idx_date',
            fields: ['date']
        },
        {
            name: 'idx_package_item_date',
            fields: ['package_item_id', 'date'],
            unique: true
        }
    ]
});

module.exports = {
    PackageDatePrice
};
