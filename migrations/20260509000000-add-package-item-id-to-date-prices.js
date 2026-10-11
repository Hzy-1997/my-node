'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 先检查列是否存在
    const tableDesc = await queryInterface.describeTable('package_date_prices');
    
    if (!tableDesc.package_item_id) {
      // 添加 package_item_id 列
      await queryInterface.addColumn('package_date_prices', 'package_item_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '关联套餐项目ID（对应package_items.id）',
        references: {
          model: 'package_items',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }

    // 添加索引
    await queryInterface.addIndex('package_date_prices', ['package_item_id'], {
      name: 'idx_package_item'
    });

    await queryInterface.addIndex('package_date_prices', ['date'], {
      name: 'idx_date'
    });

    await queryInterface.addIndex('package_date_prices', ['package_item_id', 'date'], {
      name: 'idx_package_item_date',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('package_date_prices', 'idx_package_item_date');
    await queryInterface.removeIndex('package_date_prices', 'idx_date');
    await queryInterface.removeIndex('package_date_prices', 'idx_package_item');
    await queryInterface.removeColumn('package_date_prices', 'package_item_id');
  }
};