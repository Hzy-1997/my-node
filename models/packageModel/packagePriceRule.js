const { DataTypes } = require('sequelize');
const { sequelize } = require('../../mysql/index');


const PackagePriceRule = sequelize.define('package_price_rules', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '主键'
    },
    packageItemId: {  // 改名，清晰表示关联的是 package_item
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联套餐项目ID',
        unique: true,  // 添加唯一约束，保证一对一
        references: {
            model: 'package_items',
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    ruleConfig: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: '规则配置：{"weekday":{"priceType":2,"priceValue":80},"weekend":{"priceType":1,"priceValue":150},"holiday":{"priceType":1,"priceValue":200}}'
    },
}, {
    tableName: 'package_price_rules',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            name: 'idx_package_item',
            fields: ['package_item_id'],
            unique: true,  // 索引也加唯一
        },
    ]
});

module.exports = {
    PackagePriceRule
};
