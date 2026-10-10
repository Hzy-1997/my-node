/*
 * @描述: 为room_types表添加isBuyable字段
 * @版本: 
 * @作者: 
 * @日期: 2025-02-24
 * @最后编辑者: 
 * @最后编辑时间: 2025-02-24
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */

        // 添加是否可购买字段
        await queryInterface.addColumn('room_types', 'is_buyable', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: '是否可购买'
        });

        console.log('✅ 成功为room_types表添加is_buyable字段');
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */

        // 移除是否可购买字段
        await queryInterface.removeColumn('room_types', 'is_buyable');

        console.log('✅ 成功移除room_types表的is_buyable字段');
    }
};
