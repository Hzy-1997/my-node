/*
 * @描述: 操作日志管理
 * @版本: 
 * @作者: 
 * @日期: 2026-03-28
 */

const { OperLog } = require("../../../models/Summary");
const util = require("../../../utils/util");
const { Op } = require('sequelize');

/**
 * 获取操作日志列表
 */
exports.getOperLogList = async (req, res) => {
    try {
        let {
            page = 1,
            pageSize = 10,
            title,  // 操作模块
            businessType,  // 业务类型
            operatorName,  // 操作人姓名
            status,   // 操作状态
            startTime,  // 开始时间
            endTime   // 结束时间
        } = req.query;

        page = parseInt(page);
        pageSize = parseInt(pageSize);

        // 构建查询条件
        let where = {};

        if (title) {
            where.title = { [Op.like]: `%${title}%` };
        }

        if (businessType) {
            where.businessType = businessType;
        }

        if (operatorName) {
            where.operatorName = { [Op.like]: `%${operatorName}%` };
        }

        if (status !== undefined && status !== '') {
            where.status = parseInt(status);
        }

        // 时间范围查询
        if (startTime || endTime) {
            where.operTime = {};
            if (startTime) {
                where.operTime[Op.gte] = new Date(startTime);
            }
            if (endTime) {
                where.operTime[Op.lte] = new Date(endTime);
            }
        }

        const { count, rows } = await OperLog.findAndCountAll({
            where,
            order: [['operTime', 'DESC']],
            offset: (page - 1) * pageSize,
            limit: pageSize
        });

        return res.json(util.success("获取成功", {
            list: util.formDate(rows),
            total: count,
            page,
            pageSize
        }));

    } catch (error) {
        console.error('获取操作日志列表失败:', error);
        return res.json(util.fail('获取失败', error.message));
    }
};

/**
 * 删除操作日志
 */
exports.deleteOperLog = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.json(util.fail('请提供要删除的日志ID'));
        }

        const result = await OperLog.destroy({
            where: { id }
        });

        if (result === 0) {
            return res.json(util.fail('日志不存在'));
        }

        return res.json(util.success('删除成功'));

    } catch (error) {
        console.error('删除操作日志失败:', error);
        return res.json(util.fail('删除失败', error.message));
    }
};

/**
 * 批量删除操作日志
 */
exports.batchDeleteOperLog = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json(util.fail('请提供要删除的日志ID数组'));
        }

        const result = await OperLog.destroy({
            where: {
                id: { [Op.in]: ids }
            }
        });

        return res.json(util.success(`成功删除${result}条日志`));

    } catch (error) {
        console.error('批量删除操作日志失败:', error);
        return res.json(util.fail('删除失败', error.message));
    }
};

/**
 * 清空操作日志
 */
exports.clearOperLog = async (req, res) => {
    try {
        await OperLog.destroy({
            where: {},
            truncate: true
        });

        return res.json(util.success('清空成功'));

    } catch (error) {
        console.error('清空操作日志失败:', error);
        return res.json(util.fail('清空失败', error.message));
    }
};

/**
 * 获取操作日志详情
 */
exports.getOperLogDetail = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.json(util.fail('请提供日志ID'));
        }

        const log = await OperLog.findByPk(id);

        if (!log) {
            return res.json(util.fail('日志不存在'));
        }

        return res.json(util.success('获取成功', log));

    } catch (error) {
        console.error('获取操作日志详情失败:', error);
        return res.json(util.fail('获取失败', error.message));
    }
};
