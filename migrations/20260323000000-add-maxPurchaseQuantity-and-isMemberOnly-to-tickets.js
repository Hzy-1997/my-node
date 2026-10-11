/*
 * @描述: 为tickets表添加maxPurchaseQuantity和isMemberOnly字段
 * @版本: 
 * @作者: 
 * @日期: 2026-03-23
 * @最后编辑者: 
 * @最后编辑时间: 2026-03-23
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */

        // 添加票种可购买的最大数量字段
        await queryInterface.addColumn('tickets', 'maxPurchaseQuantity', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '票种可购买的最大数量，0表示无限购买'
        });

        // 添加是否会员可购买字段
        await queryInterface.addColumn('tickets', 'isMemberOnly', {
            type: Sequelize.INTEGER,
            defaultValue: 1,
            comment: '是否会员可购买：1-是，2-否'
        });

        console.log('✅ 成功为tickets表添加maxPurchaseQuantity和isMemberOnly字段');
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */

        // 移除票种可购买的最大数量字段
        await queryInterface.removeColumn('tickets', 'maxPurchaseQuantity');

        // 移除是否会员可购买字段
        await queryInterface.removeColumn('tickets', 'isMemberOnly');

        console.log('✅ 已成功回滚：移除maxPurchaseQuantity和isMemberOnly字段');
    }
};
