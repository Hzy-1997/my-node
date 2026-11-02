

const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { QuestionsAnswers } = require("../../../models/Summary");
const { OpenAI } = require('openai');


// 操作智能问答表
exports.operationQuestionsAnswers = async (req, res) => {
    try {

        let { action, id, question, answer, category, status, } = req.body;

        if (!action) {
            return res.json(util.fail("缺少必要参数"))
        }

        if (action == "create") {
            if (!question || !answer || !category || !status) {
                return res.json(util.fail("缺少必要参数"))
            }

            let createRes = await QuestionsAnswers.findOne({
                where: {
                    question: question,
                }
            })
            if (createRes) {
                return res.json(util.fail("该问题已存在"))
            }

            let createResult = await QuestionsAnswers.create({
                category: category,
                question: question,
                answer: answer,
                status: status,
            })
            if (createResult) {
                return res.json(util.success("创建成功"))
            }

        } else if (action == "update") {

            if (!id || !question || !answer || !category || !status) {
                return res.json(util.fail("缺少必要参数"))
            }

            let updateRes = await QuestionsAnswers.update({
                category: category,
                question: question,
                answer: answer,
                status: status,
            }, {
                where: {
                    id
                }
            })
            if (updateRes) {
                return res.json(util.success("修改成功"))
            }
        } else if (action == "delete") {
            if (!id) {
                return res.json(util.fail("缺少必要参数"))
            }
            let deleteRes = await QuestionsAnswers.destroy({
                where: {
                    id
                }
            })
            if (deleteRes) {
                return res.json(util.success("删除成功"))
            }
        }





    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

// 智能问答列表
exports.questionsQuestionsAnswersList = async (req, res) => {
    let { question, status, page = 1, pageSize = 10 } = req.query;

    page = Number(page)
    pageSize = Number(pageSize)

    let where = {}
    if (question) {
        where.question = {
            [Op.like]: `%${question}%`
        }
    }
    if (status) {
        where.status = status
    }

    if (Object.keys(where).length == 0) {
        delete where.status
    }
    try {
        let questionsAnswers = await QuestionsAnswers.findAll({
            where,
            order: [
                [Sequelize.literal('CHAR_LENGTH(question)'), 'ASC'],
                ['id', 'ASC']
            ],
            offset: (page - 1) * pageSize,
            limit: pageSize,
        })
        if (questionsAnswers) {
            return res.json(util.success("获取成功", questionsAnswers))
        }
    } catch (error) {
        return res.json(util.fail(error.message))
    }
}

//AI智能回答
exports.questionsAnswersDetail = async (req, res) => {
    const { question, page = 1, pageSize = 10 } = req.body;


    if (!question) {
        return res.json(util.fail("缺少必要参数"))
    }

    try {

        //    先查询本地知识库是否有匹配的问题
        let where = {}
        if (question) {
            where.question = {
                [Op.like]: `%${question}%`
            }
        }

        let questionsAnswers = await QuestionsAnswers.findAll({
            where,
            order: [
                [Sequelize.literal('CHAR_LENGTH(question)'), 'ASC'],
                ['id', 'ASC']
            ],
            offset: (page - 1) * pageSize,
            limit: pageSize,
        })

        if (questionsAnswers && questionsAnswers.length > 0) {
            return res.json(util.success("获取成功", questionsAnswers))

        } else {

            //    如果本地知识库没有匹配的问题，再黑名单兜底
            let blackList = matchBlackList(question)
            if (blackList) {
                return res.json(util.success("获取成功", blackList.reply))
            }


            //    如果本地知识库没有匹配的问题，再调用openai模型
            const openai = new OpenAI({
                baseURL: 'https://api.deepseek.com', // 指向 DeepSeek
                apiKey: process.env.DEEPSEEK_API_KEY,
            });

            // 模型提示词
            const SYSTEM_PROMPT = `你是巴中光雾山景区的智能助手，只回答与光雾山相关的问题。

                                   【景区基本信息】
                                    - 位置：四川省巴中市南江县
                                    - 开放时间：08:30-17:30
                                    - 门票：光雾山旅游景区成人票 80 元，米仓山 90 元，十八月潭 55 元（三景区独立售票）
                                    - 观光车：约 40 元/人

                                   【核心特色】
                                    - 光雾山以红叶闻名，被誉为“中国红叶第一山”“亚洲最长天然红地毯”，红叶面积约 680 平方公里，最佳观赏期为每年 10 月中旬至 11 月中旬。四季皆可游览：春赏山花、夏避暑、秋观红叶、冬看雾凇。

                                   【主要景区与景点】
                                    - 光雾山旅游景区（桃园）：燕子岭、七女峰、万手牌朝圣、云天飞燕、太极天坑、飞云栈道
                                    - 米仓山旅游景区（大坝）：香炉山、天然画廊、黑熊沟
                                    - 十八月潭景区：十八个瀑潭相连，红叶倒映水中

                                   【交通】
                                    - 自驾最便捷，成都出发约 4.5 小时；也可乘高铁至汉中/巴中后转景区直通车。景区内需换乘观光车。

                                   【回答要求】
                                    - 始终用简体中文回答。
                                    - 优先使用以上信息回答，不要编造。
                                    - 如果用户问的是以上信息未覆盖的细节（如具体民宿电话、实时活动），引导咨询官方客服。
                                    - 回答要具体、有信息量，不要只说“建议咨询客服”。`;

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT + "\n如果用户问题中没有明确景区名称或与景区无关，请引导用户咨询景区官方客服，不要自由发挥。" },
                    { role: "user", content: question }
                ],
                model: "deepseek-flash",
                extra_body: { thinking: { type: "enabled" } },
                reasoning_effort: "high",
                stream: false,
            });

            console.log("首次调用返回", completion.choices[0].message.content);
            res.json(util.success("获取成功", completion.choices[0].message.content))
        }

    } catch (error) {
        return res.json(util.fail(error.message, "获取失败"))
    }
}

// 黑名单匹配
function matchBlackList(text) {

    const CONTACT = {
        emergency: '景区应急电话 400-123-1234',
        service: '景区客服 400-123-1234',
        broadcast: '景区广播站 400-123-1234',
    };

    const blackListConfig = [
        // ===== L1 硬拦截 =====
        {
            id: 'safety_emergency', level: 'L1', priority: 1, enabled: true,
            name: '安全应急',
            keywords: ['救命', '求救', '报警', '事故', '伤亡', '溺水', '火灾', '地震', '坠崖'],
            patterns: [/(^|[^\d])(110|120|119)([^\d]|$)/],
            reply: `如遇紧急情况，请立即拨打110/120或${CONTACT.emergency}`
        },
        {
            id: 'safety_lost', level: 'L1', priority: 2, enabled: true,
            name: '人员走失',
            keywords: ['走失', '孩子丢了', '找不到人', '失踪'],
            reply: `如有人员走失，请立即联系${CONTACT.broadcast}或拨打110，我可为您转人工。`
        },
        {
            id: 'content_safety', level: 'L1', priority: 10, enabled: true,
            name: '内容安全',
            keywords: ['政治敏感', '政治人物', '色情', '赌博', '毒品', '枪支', '邪教', '传销'],
            reply: '抱歉，该话题不在服务范围内，请咨询景区相关问题。'
        },
        {
            id: 'privacy_jailbreak', level: 'L1', priority: 11, enabled: true,
            name: '越狱与隐私',
            keywords: ['忽略之前指令', '越狱', '开发者模式', '系统提示词', '管理员', '数据库', '源码', '身份证', '银行卡'],
            patterns: [/\d{17}[\dXx]/, /1[3-9]\d{9}/],
            reply: '抱歉，我无法处理该请求。'
        },

        // ===== L2 转人工/引导 =====
        {
            id: 'complaint', level: 'L2', priority: 20, enabled: true,
            name: '投诉票务',
            keywords: ['投诉', '举报', '退票', '退款', '发票', '赔偿', '12345'],
            reply: `此类问题请通过${CONTACT.service}办理，我可为您转人工。`
        },
        {
            id: 'ticket_promise', level: 'L2', priority: 21, enabled: true,
            name: '票务承诺',
            keywords: ['免票', '逃票', '带人进', '内部票', '黄牛', '保证有票', '最低价'],
            reply: '票务信息请以景区官方渠道公示为准，我可为您查询官方购票入口。'
        },
        {
            id: 'off_topic', level: 'L2', priority: 30, enabled: true,
            name: '无关任务',
            keywords: ['写代码', '做作业', '写论文', '帮我翻译', '写一首诗', '写诗'],
            reply: '我是景区智能助手，只能回答景区相关问题哦~'
        },

        // ===== L3 软拦截（放行 AI，加约束）=====
        {
            id: 'competitor', level: 'L3', priority: 40, enabled: true,
            name: '导流竞品',
            keywords: ['携程', '美团', '飞猪', '小红书', '旅行社', '包车', '民宿推荐'],
            reply: '建议通过景区官方小程序/公众号获取服务。'
        }
    ];

    const rules = blackListConfig
        .filter(r => r.enabled)
        .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
        const hitKw = rule.keywords?.find(k => text.includes(k));
        const hitRe = rule.patterns?.find(p => p.test(text));
        if (hitKw || hitRe) {
            return { ...rule, hit: hitKw || String(hitRe) };
        }
    }
    return null;
}



