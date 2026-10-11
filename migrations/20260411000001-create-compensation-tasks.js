"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compensation_tasks'`,
      { plain: true }
    );

    if (tableExists.count > 0) {
      console.log('[Migration] compensation_tasks 表已存在，跳过创建');
      return;
    }

    // 创建补偿任务表
    await queryInterface.createTable("compensation_tasks", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: '任务类型',
      },
      orderNo: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: '订单号',
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '票务ID',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '用户ID',
      },
      seats: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '座位信息',
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: "pending",
        comment: '状态：pending, success, failed',
      },
      retryCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '重试次数',
      },
      maxRetry: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        comment: '最大重试次数',
      },
      expireTime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: '任务过期时间',
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '完成时间',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    console.log('[Migration] ✅ compensation_tasks 表已创建');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("compensation_tasks");
  },
};
