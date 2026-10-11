"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 修复非法的JSON数据
    console.log('[Migration] 开始修复seat字段数据...');

    await queryInterface.sequelize.query(
      `UPDATE orders SET seat = NULL WHERE seat = '' OR seat = 'null'`
    );

    await queryInterface.sequelize.query(
      `UPDATE orders SET seat = NULL WHERE seat IS NOT NULL AND TRIM(seat) = ''`
    );

    await queryInterface.sequelize.query(
      `UPDATE orders SET seat = CONCAT('["', seat, '"]') WHERE seat IS NOT NULL AND JSON_VALID(seat) = 0`
    );

    console.log('[Migration] 数据修复完成');

    // 2. 修改seat字段为JSON类型
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '选座信息',
    });

    console.log('[Migration] ✅ seat字段已成功改为JSON类型');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("orders", "seat", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
