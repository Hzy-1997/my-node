/**
 * seed 脚本：批量导入光雾山智能问答数据（abc.js，共 70 条）
 * 用法：node migrations/seed-questions-answers.js
 *
 * 数据处理说明：
 *   - abc.js 里 category 是数字 1-6，模型字段是字符串，导入前转成 String
 *   - abc.js 没有 status 字段，模型必填（1-禁用，2-启用），默认导入为 "2"（启用）
 *   - 忽略 abc.js 里的 id，让表自增分配，避免与已有数据主键冲突
 *
 * 幂等：按 question 内容去重，已存在的问题会跳过，可安全重跑。
 */
const { Op } = require('sequelize');
const { sequelize } = require('../mysql/index');
const { QuestionsAnswers } = require('../models/Summary');
const { guangwushanQA } = require('../models/questionsAnswersModel/abc');

(async () => {
    try {
        await sequelize.authenticate();

        // 转换成模型字段格式
        const rows = guangwushanQA.map((item) => ({
            category: String(item.category),
            question: item.question,
            answer: item.answer,
            status: '2',
        }));

        // 查询已存在的问题，按内容去重
        const existing = await QuestionsAnswers.findAll({
            where: { question: { [Op.in]: rows.map((r) => r.question) } },
            attributes: ['question'],
        });
        const existingSet = new Set(existing.map((r) => r.question));
        const toInsert = rows.filter((r) => !existingSet.has(r.question));

        if (toInsert.length === 0) {
            console.log(`[Seed] 智能问答数据均已存在（共 ${rows.length} 条），无需导入`);
        } else {
            await QuestionsAnswers.bulkCreate(toInsert);
            console.log(`[Seed] 成功导入 ${toInsert.length} 条智能问答，跳过已存在 ${rows.length - toInsert.length} 条`);
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('[Seed] 导入失败:', error.message);
        process.exit(1);
    }
})();
