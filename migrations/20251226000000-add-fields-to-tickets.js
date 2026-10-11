/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
/*
 * @描述: 为tickets表添加soldCount和typeDescription字段
 * @版本: 
 * @作者: 
 * @日期: 2025-12-26
 * @最后编辑者: 
 * @最后编辑时间: 2025-12-26
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         */

        // 添加已售数量字段
        await queryInterface.addColumn('tickets', 'soldCount', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '已售数量'
        });

        // 添加类型说明字段
        await queryInterface.addColumn('tickets', 'typeDescription', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: '类型说明（如：不可退款、限时抢购、实名开卡、未核销可退等）'
        });

        console.log('✅ 成功为tickets表添加soldCount和typeDescription字段');
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         */

        // 移除已售数量字段
        await queryInterface.removeColumn('tickets', 'soldCount');

        // 移除类型说明字段
        await queryInterface.removeColumn('tickets', 'typeDescription');

        console.log('✅ 成功移除tickets表的soldCount和typeDescription字段');
    }
};