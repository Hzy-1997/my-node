/*
 * @描述: 为tickets表添加isRecommended字段
 * @版本: 
 * @作者: 
 * @日期: 2025-12-29
 * @最后编辑者: 
 * @最后编辑时间: 2025-12-29
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */

        // 添加是否被推荐字段
        await queryInterface.addColumn('tickets', 'isRecommended', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: '是否被推荐：1-否，2-是'
        });

        console.log('✅ 成功为tickets表添加isRecommended字段');
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */

        // 移除是否被推荐字段
        await queryInterface.removeColumn('tickets', 'isRecommended');

        console.log('✅ 成功移除tickets表的isRecommended字段');
    }
};