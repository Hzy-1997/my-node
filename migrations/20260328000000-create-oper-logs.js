'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('oper_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
                comment: '操作ID（主键）'
            },
            title: {
                type: Sequelize.STRING(100),
                allowNull: true,
                comment: '操作标题/模块名称'
            },
            business_type: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: '业务类型（如：增删改查）'
            },
            method: {
                type: Sequelize.STRING(200),
                allowNull: true,
                comment: '方法名称'
            },
            request_method: {
                type: Sequelize.STRING(10),
                allowNull: true,
                comment: '请求方式（GET/POST/PUT/DELETE）'
            },
            operator_type: {
                type: Sequelize.STRING(20),
                allowNull: true,
                comment: '操作人员类型（如：管理员/普通用户）'
            },
            operator_name: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: '操作人员姓名'
            },
            dept_name: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: '部门名称'
            },
            oper_url: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: '操作URL地址'
            },
            oper_ip: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: '操作者IP地址'
            },
            oper_location: {
                type: Sequelize.STRING(100),
                allowNull: true,
                comment: '操作地点'
            },
            oper_param: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: '操作参数（请求参数）'
            },
            json_result: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: '返回结果（JSON格式）'
            },
            status: {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 0,
                comment: '操作状态（0-成功，1-失败）'
            },
            error_msg: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: '错误信息'
            },
            oper_time: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: '操作时间'
            },
            cost_time: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: '耗时（毫秒）'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                comment: '创建时间'
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
                comment: '更新时间'
            }
        });

        // 添加索引
        await queryInterface.addIndex('oper_logs', ['operator_name'], {
            name: 'idx_operator_name'
        });
        await queryInterface.addIndex('oper_logs', ['oper_time'], {
            name: 'idx_oper_time'
        });
        await queryInterface.addIndex('oper_logs', ['status'], {
            name: 'idx_status'
        });

        console.log('✅ oper_logs 表创建成功');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('oper_logs');
        console.log('✅ oper_logs 表已删除');
    }
};
