'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. 添加新字段到 package_items
      await queryInterface.addColumn('package_items', 'item_type', {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '子项类型：1=酒店房型 2=门票 3=其他'
      }, { transaction });

      await queryInterface.addColumn('package_items', 'room_package_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '关联酒店房型套餐ID（itemType=1时必填）',
        references: {
          model: 'room_packages',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      }, { transaction });

      await queryInterface.addColumn('package_items', 'ticket_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '关联门票ID（itemType=2时必填）',
        references: {
          model: 'tickets',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      }, { transaction });

      await queryInterface.addColumn('package_items', 'ticket_price_rule_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '关联门票价格规则ID（itemType=2时必填），用于查TicketDatePrice库存',
        references: {
          model: 'price_rules',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      }, { transaction });

      await queryInterface.addColumn('package_items', 'item_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '显示名称（冗余，如"豪华大床房"）'
      }, { transaction });

      // 2. 迁移数据：根据旧字段 biz_type 和 biz_id 填充新字段
      // 假设旧字段名为 biz_type, biz_id, biz_name（请根据实际表结构调整）
      // 如果旧字段不存在，请手动调整或跳过此步骤
      // 这里提供示例 SQL，实际执行前请确认旧字段名
      // await queryInterface.sequelize.query(`
      //   UPDATE package_items
      //   SET
      //     item_type = CASE WHEN biz_type = 'hotel' THEN 1 WHEN biz_type = 'ticket' THEN 2 ELSE 3 END,
      //     room_package_id = CASE WHEN biz_type = 'hotel' THEN biz_id ELSE NULL END,
      //     ticket_id = CASE WHEN biz_type = 'ticket' THEN biz_id ELSE NULL END,
      //     item_name = biz_name
      // `, { transaction });

      // 3. 添加索引
      await queryInterface.addIndex('package_items', ['room_package_id'], {
        name: 'idx_room_package',
        transaction
      });
      await queryInterface.addIndex('package_items', ['ticket_id'], {
        name: 'idx_ticket',
        transaction
      });
      await queryInterface.addIndex('package_items', ['ticket_price_rule_id'], {
        name: 'idx_ticket_price_rule',
        transaction
      });

      // 4. 删除旧字段（请确认旧字段名后再执行）
      // await queryInterface.removeColumn('package_items', 'biz_type', { transaction });
      // await queryInterface.removeColumn('package_items', 'biz_id', { transaction });
      // await queryInterface.removeColumn('package_items', 'biz_name', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 回滚：删除新字段（如果需要恢复旧字段，请手动补充）
      await queryInterface.removeColumn('package_items', 'item_name', { transaction });
      await queryInterface.removeColumn('package_items', 'ticket_price_rule_id', { transaction });
      await queryInterface.removeColumn('package_items', 'ticket_id', { transaction });
      await queryInterface.removeColumn('package_items', 'room_package_id', { transaction });
      await queryInterface.removeColumn('package_items', 'item_type', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
