/*
 * @描述: 为酒店订单补全退款/核销相关字段，并扩展核销员表与退款单表的区分字段
 *        - hotel_order: 增加 alipayTradeNo(支付宝交易号,退款必需)、verifyStatus(核销状态)
 *        - write_offs:  增加 type(核销员类型:1=票务,2=酒店)，复用同一张表
 *        - refund_orders: 增加 orderType(订单类型:1=票务,2=套餐,3=酒店)，便于退款列表筛选
 * @日期: 2026-07-21
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. hotel_order 表新增字段（带幂等保护，重复执行不报错）
        // 1.1 alipayTradeNo 支付宝交易号（退款时调用支付宝必传）
        try {
            await queryInterface.addColumn('hotel_order', 'alipayTradeNo', {
                type: Sequelize.STRING,
                allowNull: true,
                comment: '支付宝交易号（退款必需）',
            });
            console.log('[Migration] hotel_order.alipayTradeNo 已添加');
        } catch (e) {
            console.log('[Migration] hotel_order.alipayTradeNo 已存在，跳过:', e.message);
        }

        // 1.2 verifyStatus 核销状态：1-待核销,2-已核销,3-已取消
        try {
            await queryInterface.addColumn('hotel_order', 'verifyStatus', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 1,
                comment: '核销状态：1-待核销,2-已核销,3-已取消',
            });
            console.log('[Migration] hotel_order.verifyStatus 已添加');
        } catch (e) {
            console.log('[Migration] hotel_order.verifyStatus 已存在，跳过:', e.message);
        }

        // 2. write_offs 表新增 type 字段（区分票务/酒店核销员）
        try {
            await queryInterface.addColumn('write_offs', 'type', {
                type: Sequelize.TINYINT,
                allowNull: false,
                defaultValue: 1,
                comment: '核销员类型：1-票务,2-酒店',
            });
            console.log('[Migration] write_offs.type 已添加');
        } catch (e) {
            console.log('[Migration] write_offs.type 已存在，跳过:', e.message);
        }

        // 3. refund_orders 表新增 orderType 字段（区分订单来源）
        try {
            await queryInterface.addColumn('refund_orders', 'orderType', {
                type: Sequelize.TINYINT,
                allowNull: false,
                defaultValue: 1,
                comment: '订单类型：1-票务,2-套餐,3-酒店',
            });
            console.log('[Migration] refund_orders.orderType 已添加');
        } catch (e) {
            console.log('[Migration] refund_orders.orderType 已存在，跳过:', e.message);
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('hotel_order', 'alipayTradeNo').catch(() => { });
        await queryInterface.removeColumn('hotel_order', 'verifyStatus').catch(() => { });
        await queryInterface.removeColumn('write_offs', 'type').catch(() => { });
        await queryInterface.removeColumn('refund_orders', 'orderType').catch(() => { });
    }
};
