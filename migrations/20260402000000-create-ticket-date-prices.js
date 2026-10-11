'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ticket_date_prices', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '每日价格ID'
      },
      price_rule_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '关联价格规则ID',
        references: {
          model: 'price_rules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: '日期'
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: '当日价格'
      },
      price_type: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '价格类型：1-规则价格，2-手动价格'
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '当日库存'
      },
      sold_stock: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '已售库存'
      },
      available_stock: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '可售库存'
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '状态：1-启用，2-禁用'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    }, {
      indexes: [
        {
          name: 'idx_price_rule_id',
          fields: ['price_rule_id']
        },
        {
          name: 'idx_date',
          fields: ['date']
        },
        {
          name: 'idx_price_rule_date',
          fields: ['price_rule_id', 'date'],
          unique: true
        }
      ]
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ticket_date_prices');
  }
};
