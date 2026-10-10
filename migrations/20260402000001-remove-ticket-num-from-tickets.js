'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 检查字段是否存在，如果存在则删除
    const tableDescription = await queryInterface.describeTable('tickets');
    
    if (tableDescription.ticket_num) {
      await queryInterface.removeColumn('tickets', 'ticket_num');
      console.log('已删除 ticket_num 字段');
    } else {
      console.log('ticket_num 字段不存在，无需删除');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚操作：重新添加字段
    await queryInterface.addColumn('tickets', 'ticket_num', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '购票数量'
    });
    console.log('已重新添加 ticket_num 字段');
  }
};
