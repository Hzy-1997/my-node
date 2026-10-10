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
        await queryInterface.addColumn('orders', 'paymentTime', {
            type: Sequelize.DATE,
            allowNull: true,
            comment: '支付时间'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('orders', 'paymentTime');
    }
};
