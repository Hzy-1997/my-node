/**
 * 迁移文件：添加 remainingStock 字段到 tickets 表
 * 用于秒杀系统，区分总库存和剩余库存
 */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 添加 remainingStock 字段
        await queryInterface.addColumn('tickets', 'remainingStock', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '剩余可售库存'
        });

        // 初始化 remainingStock = stock（总库存）
        await queryInterface.sequelize.query(
            'UPDATE tickets SET remainingStock = stock'
        );

        console.log('remainingStock 字段添加成功，已初始化为 stock 的值');
    },

    down: async (queryInterface, Sequelize) => {
        // 回滚：删除 remainingStock 字段
        await queryInterface.removeColumn('tickets', 'remainingStock');
        console.log('remainingStock 字段已删除');
    }
};
