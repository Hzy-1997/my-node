
const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { DictCategory, DictData } = require("../../../models/Summary");



// 字段操作
exports.field = async (req, res) => {
    try {

        const { action, dictName, dictType } = req.body;
        if (!action || !dictName || !dictType) {
            return res.json(util.fail('缺少必要参数'));
        }

        if (action === 'create') {
            const dictCategory = await DictCategory.findOne({ where: { dictName } });
            if (dictCategory) return res.send(util.fail('字典类型已存在'));
            const result = await DictCategory.create({ ...req.body });
            if (!result) return res.json(util.fail("创建失败"));
            return res.json(util.success("创建成功"));

        } else if (action === 'update') {
            const { id } = req.body;
            const dictCategory = await DictCategory.findOne({ where: { id: id } });
            if (!dictCategory) return res.json(util.fail('字典类型不存在'));
            const result = await DictCategory.update({ ...req.body }, { where: { id: id } });
            if (!result) return res.json(util.fail("更新失败"));
            return res.json(util.success("更新成功"));

        } else if (action === 'delete') {
            const { id } = req.body;
            const result = await DictCategory.destroy({ where: { id } });
            if (!result) return res.json(util.fail("删除失败"));
            return res.json(util.success("删除成功"));
        }

    } catch (error) {
        return res.json(util.fail(error.message));

    }
}


// 获取字典列表
exports.getDictTypeList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, dictName, dictType, status } = req.query;

        page = parseInt(page);
        pageSize = parseInt(pageSize);

        const where = {};
        if (dictName) where.dictName = { [Op.like]: `%${dictName}%` };
        if (dictType) where.dictType = dictType;
        if (status) where.status = status;
        const { rows, count } = await DictCategory.findAndCountAll({
            where: where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
        });
        return res.json(util.success("获取成功", { rows: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}


// 字典数据操作
exports.dictDataField = async (req, res) => {
    try {

        let { action, dictType, dictLabel, dictValue } = req.body;
        if (!action || !dictType || !dictLabel || !dictValue) {
            return res.json(util.fail('缺少必要参数'));
        }

        if (action === 'create') {
            const dictCategory = await DictCategory.findOne({ where: { dictType } });
            if (!dictCategory) return res.json(util.fail('字典类型不存在'));
            const dictData = await DictData.findOne({ where: { dictType, dictValue } });
            if (dictData) return res.json(util.fail('字典数据已存在'));
            const result = await DictData.create({ ...req.body });
            if (!result) return res.json(util.fail("创建失败"));
            return res.json(util.success("创建成功"));

        } else if (action === 'update') {
            const { id } = req.body;
            const dictData = await DictData.findOne({ where: { id: id } });
            if (!dictData) return res.json(util.fail('字典数据不存在'));
            const result = await DictData.update({ ...req.body }, { where: { id: id } });
            if (!result) return res.json(util.fail("更新失败"));
            return res.json(util.success("更新成功"));

        } else if (action === 'delete') {
            const { id } = req.body;
            const result = await DictData.destroy({ where: { id } });
            if (!result) return res.json(util.fail("删除失败"));
            return res.json(util.success("删除成功"));
        }

    } catch (error) {
        return res.json(util.fail(error.message));

    }
}


// 获取字典数据列表
exports.getDictDataList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, dictType, dictLabel, dictValue, status } = req.query;

        page = parseInt(page);
        pageSize = parseInt(pageSize);

        const where = {};
        if (dictType) where.dictType = dictType;
        if (dictLabel) where.dictLabel = { [Op.like]: `%${dictLabel}%` };
        if (dictValue) where.dictValue = dictValue;
        if (status) where.status = status;
        const { rows, count } = await DictData.findAndCountAll({
            where: where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
        });
        return res.json(util.success("获取成功", { rows: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}


// 前端字典调用接口（按 dictType 字符串匹配查询，不建表关联）
exports.getDictDataByType = async (req, res) => {
    try {
        const { dictType } = req.query;
        if (!dictType) return res.json(util.fail('缺少必要参数'));

        const dictCategory = await DictCategory.findOne({ where: { dictType } });
        if (!dictCategory) return res.json(util.fail('字典类型不存在'));

        const rows = await DictData.findAll({
            where: { dictType, status: 1 },
            order: [['dictSort', 'ASC']],
        });
        return res.json(util.success("获取成功", rows));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}