/*
 * @描述: 轮播图管理接口
 * @版本:
 * @作者:
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Op } = require("sequelize");
const util = require("../../../utils/util.js");
const { Banner } = require("../../../models/Summary.js");


// 轮播图操作（创建/更新/删除）
exports.banner = async (req, res) => {

    const { action } = req.body;

    if (!action) return res.json(util.fail("操作类型不能为空"));

    // 剔除操作字段，避免误写入模型
    const { action: _, ...payload } = req.body;

    try {

        if (action == "create") {
            const { positionCode, imageUrl } = req.body;
            if (!positionCode) return res.json(util.fail("位置编码不能为空"));
            if (!imageUrl) return res.json(util.fail("图片地址不能为空"));

            await Banner.create(payload);
            return res.json(util.success("创建成功"));

        } else if (action == "update") {
            const { id } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));
            let data = await Banner.findByPk(id);
            if (!data) return res.json(util.fail("轮播图不存在"));

            const { id: __, ...values } = payload;
            await Banner.update(values, {
                where: {
                    id
                }
            });
            return res.json(util.success("更新成功"));
        } else if (action == "delete") {
            const { id } = req.body;
            if (!id) return res.json(util.fail("缺少必要参数"));
            let data = await Banner.findByPk(id);
            if (!data) return res.json(util.fail("轮播图不存在"));

            await Banner.destroy({
                where: {
                    id
                }
            });

            return res.json(util.success("删除成功"));
        } else {
            return res.json(util.fail("不支持的操作类型"));
        }

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}

// 获取轮播图列表
exports.bannerList = async (req, res) => {
    try {
        let { title, positionCode, status, page = 1, pageSize = 10, } = req.query;

        page = parseInt(page);
        pageSize = parseInt(pageSize);

        let where = {};
        if (title) where.title = { [Op.like]: `%${title}%` }; // 标题（模糊查询）
        if (positionCode) where.positionCode = positionCode; // 位置编码（精确查询）
        if (status !== undefined && status !== "") where.status = parseInt(status); // 状态（0-禁用也能筛选）

        const { rows, count } = await Banner.findAndCountAll({
            where,
            attributes: { exclude: ["createdAt", "updatedAt"] },
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [["sort", "ASC"], ["id", "DESC"]], // 排序号越大越靠前
        });

        return res.json(util.success("获取成功", {
            rows,
            count
        }));

    } catch (error) {
        return res.json(util.fail("系统出错", error.message));
    }
}
