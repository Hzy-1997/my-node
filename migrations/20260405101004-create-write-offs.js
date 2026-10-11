'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('write_offs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: '核销员姓名',
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: '核销员手机号',
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '核销状态：1-启用，2-停用',
      },
      today_write_off: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '今日核销次数',
      },
      last_write_off_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '最后一次核销时间',
      },
      operator: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: '操作人',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('write_offs');
  }
};
