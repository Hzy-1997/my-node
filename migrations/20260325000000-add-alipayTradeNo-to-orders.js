/*
 * @描述: 为orders表添加alipayTradeNo字段（支付宝交易号）
 * @版本: 
 * @作者: 
 * @日期: 2026-03-25
 * @最后编辑者: 
 * @最后编辑时间: 2026-03-25
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */
        await queryInterface.addColumn('orders', 'alipayTradeNo', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: '支付宝交易号'
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */
        await queryInterface.removeColumn('orders', 'alipayTradeNo');
    }
};
