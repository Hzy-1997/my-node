/*
 * @描述: 为orders表添加title字段
 * @版本: 
 * @作者: 
 * @日期: 2026-03-16
 * @最后编辑者: 
 * @最后编辑时间: 2026-03-16
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */
        await queryInterface.addColumn('orders', 'title', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: '票名称'
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */
        await queryInterface.removeColumn('orders', 'title');
    }
};
