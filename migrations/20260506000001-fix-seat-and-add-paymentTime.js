/*
 * @描述: 为orders表添加paymentTime字段（支付时间）
 * @版本:
 * @作者:
 * @日期: 2026-05-06
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const columnExists = await queryInterface.sequelize.query(
            `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'paymentTime'`,
            { plain: true }
        );

        if (columnExists.count > 0) {
            console.log('[Migration] paymentTime 字段已存在，跳过');
            return;
        }

        await queryInterface.addColumn('orders', 'paymentTime', {
            type: Sequelize.DATE,
            allowNull: true,
            comment: '支付时间'
        });

        console.log('[Migration] ✅ paymentTime 字段已添加');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('orders', 'paymentTime');
    }
};
