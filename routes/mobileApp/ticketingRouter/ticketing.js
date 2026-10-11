/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { post, get } = require("../../../utils/request");
const { eachDayOfInterval, format, isWeekend, parseISO, addDays } = require("date-fns");

// 首先引入所有模型
const { Ticket, PriceRule, holiday } = require("../../../models/Summary");

// 获取票务详细日期价格
exports.getTicketDatePrices = async (req, res) => {
    try {
        const { ticketId, startDate, endDate } = req.query;

        if (!ticketId) {
            return res.json(util.fail("票务ID不能为空"));
        }

        // 获取票务信息
        const ticket = await Ticket.findOne({
            where: { id: ticketId },
            include: [
                {
                    model: PriceRule,
                    as: 'priceRules',
                    attributes: ['id', 'startDate', 'endDate', 'ruleConfig', 'stock', 'status'],
                    where: { status: 1 },
                    required: false
                }
            ]
        });

        if (!ticket) {
            return res.json(util.fail("票务不存在"));
        }


        // 计算日期价格
        let datePrices = await calculateDatePrices(ticket, ticket.priceRules);


        // 根据日期范围过滤
        if (startDate && endDate) {
            datePrices = datePrices.filter(item => {
                const itemDate = new Date(item.date);
                const start = new Date(startDate);
                const end = new Date(endDate);
                return itemDate >= start && itemDate <= end;
            });
        }

        // 按月份分组
        const pricesByMonth = {};
        datePrices.forEach(item => {
            const month = item.date.substring(0, 30); // YYYY-MM格式
            if (!pricesByMonth[month]) {
                pricesByMonth[month] = [];
            }
            pricesByMonth[month].push(item);
        });

        res.json(util.success("获取成功", {
            ticket: {
                id: ticket.id,
                title: ticket.title,
                price: ticket.price,
                stock: ticket.stock
            },
            datePrices: datePrices,
            pricesByMonth: pricesByMonth
        }));

    } catch (error) {
        console.error("获取票务日期价格错误:", error);
        res.json(util.fail("服务器内部错误", error.message));
    }
}

// 获取第三方日期数据
exports.getThirdPartyData = async (req, res) => {
    try {
        const { thisYear = new Date().getFullYear() } = req.query;
        const nextYear = new Date().getFullYear() + 1;


        let data = await holiday.findAll()
        if (!data) return res.json(util.fail("获取数据失败,请联系管理员"));
        if (data[0].year > thisYear) return res.json(util.success("年份正确", data));


        // 清空旧数据
        await holiday.destroy({ where: {}, truncate: true });

        // 并行执行两个请求
        const [currentYearData, nextYearData] = await Promise.all([
            getData(thisYear),
            getData(nextYear)
        ]);
        // 合并两个年份的数据
        const combinedData = {
            thisYear: JSON.stringify(currentYearData.data.showapi_res_body.data),
            nextYear: JSON.stringify(nextYearData.data.showapi_res_body.data),
            year: nextYear,
        };
        await holiday.create(combinedData)

        res.json(util.success("获取成功"));

    } catch (error) {
        console.error("获取第三方数据错误:", error);
        res.json(util.fail("服务器内部错误", error.message));
    }
}

// 基础请求函数
const getData = async (year) => {
    const params = new URLSearchParams();
    params.append('year', year.toString());

    const result = await post('https://route.showapi.com/894-4',
        params.toString(),
        {
            headers: {
                'appKey': '4E2f7d559C64462F97636B9536ec15Db',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000
        }
    );

    return result;
}




// 日期价格计算工具函数

let thisYears = "" //当前年份
let nextYears = "" //下一年份
const calculateDatePrices = async (ticket, priceRules) => {
    if (!priceRules || priceRules.length === 0) {
        return [];
    }

    // 获取节假日数据
    const holidayData = await holiday.findOne();
    if (!holidayData) {
        console.warn("未找到节假日数据，无法计算日期价格");
        return [];
    }
    // 获取节假日数据   holidays:所有放假日期 makeUpDays:所有补班日期
    thisYears = processHolidayData(JSON.parse(holidayData.thisYear));
    nextYears = processHolidayData(JSON.parse(holidayData.nextYear));
    const datePrices = [];
    const today = new Date();

    // 对每个价格规则生成对应的日期价格
    for (const rule of priceRules) {
        // 如果规则开始日期早于今天，则从今天开始
        const ruleStart = new Date(Math.max(new Date(rule.startDate).getTime(), today.getTime()));

        // 如果没有设置结束日期，则默认为当前日期
        let ruleEnd = rule.endDate ? new Date(rule.endDate) : new Date();
        if (!rule.endDate) {
            ruleEnd.setMonth(today.getMonth() + 3); // 只有没有结束日期时设置未来3个月
        } else {
            // 如果设置了结束日期，确保不超过未来3个月
            const maxEndDate = new Date();
            maxEndDate.setMonth(today.getMonth() + 3);
            if (ruleEnd > maxEndDate) {
                ruleEnd = maxEndDate;
            }
        }

        const ruleConfig = rule.ruleConfig; // 规则配置

        //处理当前日期范围的 三种日期状态：工作日、节假日、补班日
        const result = getWorkdaysAndHolidays(ruleStart, ruleEnd);


        // 根据日期类型和价格规则计算最终价格
        const ruleDatePrices = generateDatePrices(ticket.price, result, ruleConfig);


        // 将价格数据添加到结果中
        datePrices.push(...ruleDatePrices);

    }

    return datePrices.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// 处理节假日数据的函数
function processHolidayData(apiData) {
    const holidays = []; // 所有放假日期
    const makeUpDays = []; // 所有补班日期

    apiData.forEach((holiday) => {
        const begin = holiday.begin;
        const end = holiday.end;
        const inverseDays = holiday.inverse_days || [];

        // 遍历放假期间的每一天
        const startDate = parseISO(begin.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
        const endDate = parseISO(end.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));

        let currentDate = startDate;
        while (currentDate <= endDate) {
            holidays.push(format(currentDate, "yyyy-MM-dd"));
            currentDate = addDays(currentDate, 1);
        }

        // 2. 添加补班日期
        inverseDays.forEach((dayStr) => {
            const dateStr = dayStr.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
            makeUpDays.push(dateStr);
        });
    });

    return {
        holidays: [...new Set(holidays)], // 去重
        makeUpDays: [...new Set(makeUpDays)], // 去重
    };
}

// 主函数：获取节假日、工作日、周末
function getWorkdaysAndHolidays(startDate, endDate) {
    if (typeof startDate === 'string') {
        startDate = parseISO(startDate);
    }
    if (typeof endDate === 'string') {
        endDate = parseISO(endDate);
    }
    const weekends = [];
    const holidays = [];
    const workdays = [];

    const dates = eachDayOfInterval({ start: startDate, end: endDate });

    // 合并当前年份和下一年份的节假日数据，处理跨年份情况
    const allHolidays = [...thisYears.holidays, ...nextYears.holidays];
    const allMakeUpDays = [...thisYears.makeUpDays, ...nextYears.makeUpDays];

    // 将数组转为Set以提高查询效率
    const holidaySet = new Set(allHolidays);
    const makeUpSet = new Set(allMakeUpDays);

    dates.forEach((date) => {
        const dateStr = format(date, "yyyy-MM-dd");

        // 判断逻辑：
        // 1. 先判断是否为节假日（放假日期）
        if (holidaySet.has(dateStr)) {
            holidays.push(dateStr);
        }
        // 2. 再判断是否为补班日（需要上班的特殊日期）或正常工作日
        else if (makeUpSet.has(dateStr) || !isWeekend(date)) {
            workdays.push(dateStr);
        }
        // 3. 否则是正常周末（且不是补班日）
        else {
            weekends.push(dateStr);
        }
    });

    return {
        weekends,
        holidays,
        workdays,
        dateRange: {
            start: format(startDate, "yyyy-MM-dd"),
            end: format(endDate, "yyyy-MM-dd"),
        },
    };
}

// 根据日期类型和价格规则计算最终价格
function calculateDatePrice(basePrice, dateType, ruleConfig) {
    if (!ruleConfig || !ruleConfig[dateType]) {
        return basePrice; // 如果没有对应规则，返回原价
    }

    const config = ruleConfig[dateType];
    const { priceType, priceValue } = config;

    switch (priceType) {
        case 1: // 固定价格
            return priceValue;
        case 2: // 百分比上涨
            return Math.round(basePrice * (1 + priceValue / 100));
        case 3: // 百分比降价
            return Math.round(basePrice * (1 - priceValue / 100));
        case 4: // 原价
        default:
            return basePrice;
    }
}

// 生成日期区间段的价格数据
function generateDatePrices(basePrice, dateResult, ruleConfig) {
    const datePrices = [];

    // 处理工作日价格
    dateResult.workdays.forEach(dateStr => {
        const finalPrice = calculateDatePrice(basePrice, 'weekday', ruleConfig);
        datePrices.push({
            date: dateStr,
            originalPrice: basePrice, // 原价
            price: finalPrice, // 折扣后的价格
            dateType: 'workday',
            dateTypeName: '工作日'
        });
    });

    // 处理周末价格
    dateResult.weekends.forEach(dateStr => {
        const finalPrice = calculateDatePrice(basePrice, 'weekend', ruleConfig);
        datePrices.push({
            date: dateStr,
            originalPrice: basePrice,
            price: finalPrice,
            dateType: 'weekend',
            dateTypeName: '周末'
        });
    });

    // 处理节假日价格
    dateResult.holidays.forEach(dateStr => {
        const finalPrice = calculateDatePrice(basePrice, 'holiday', ruleConfig);
        datePrices.push({
            date: dateStr,
            originalPrice: basePrice,
            price: finalPrice,
            dateType: 'holiday',
            dateTypeName: '节假日'
        });
    });

    // 按日期排序
    return datePrices.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// 票务列表
exports.ticketList = async (req, res) => {
    try {
        let { category } = req.query;
        let where = {
            saleEndDate: {
                [Op.gte]: new Date() // 售卖截止日期大于等于当前时间
            }
        };

        // 处理分类筛选
        if (category) {
            const categoryNum = parseInt(category);
            if (categoryNum === 0) {
                // 获取推荐票务
                where.isRecommended = 1;
            } else {
                // 按具体分类筛选
                where.category = categoryNum;
            }
        }


        // 获取票务列表，包含关联的价格规则
        let list = await Ticket.findAll({
            where,
            include: [
                {
                    model: PriceRule,
                    as: 'priceRules',
                    attributes: ['id', 'startDate', 'endDate', 'ruleConfig', 'stock', 'status'],
                    where: { status: 1 }, // 只查询启用状态的规则
                    required: false // 左连接，即使没有价格规则也返回票务
                }
            ],
            order: [['createdAt', 'DESC']] // 按创建时间倒序排列
        });

        list = util.formDate(list);

        // 为每个票务生成日期价格并计算最低折扣价
        const ticketListWithPrices = await Promise.all(
            list.map(async (ticket) => {
                const datePrices = await calculateDatePrices(ticket, ticket.priceRules);
                // 计算最低折扣价格（从所有日期价格中取最小值）
                let discountPrice = ticket.price; // 默认使用原价
                if (datePrices && datePrices.length > 0) {
                    const prices = datePrices.map(item => item.price);
                    discountPrice = Math.min(...prices);
                }

                return {
                    ...ticket,
                    discountPrice: discountPrice, // 最低折扣价格
                    originalPrice: ticket.price,   // 原价
                    datePrices: datePrices // 返回所有生成的日期价格
                };
            })
        );

        let data = ticketListWithPrices;


        res.json(util.success("获取成功", data));

    } catch (error) {
        console.error("获取票务列表错误:", error);
        res.json(util.fail("服务器内部错误11", error.message));
    }
}

// 获取票务详情
exports.ticketInfor = async (req, res) => {

    try {

        let { id } = req.query;

        if (!id) return res.json(util.fail("缺少必要参数"))

        // 获取票务信息，包含关联的价格规则
        let ticket = await Ticket.findOne({
            where: { id },
            include: [
                {
                    model: PriceRule,
                    as: 'priceRules',
                    attributes: ['id', 'startDate', 'endDate', 'ruleConfig', 'stock', 'status'],
                    where: { status: 1 }, // 只查询启用状态的规则
                    required: false // 左连接，即使没有价格规则也返回票务
                }
            ]
        })

        if (!ticket) return res.json(util.fail("未查询到相关票务信息"))

        // 为票务生成日期价格
        const datePrices = await calculateDatePrices(ticket, ticket.priceRules);

        // 返回票务详情，包含日期价格信息
        const ticketWithPrices = {
            ...ticket.toJSON(),
            datePrices: datePrices
        };

        return res.json(util.success("获取成功", ticketWithPrices));

    } catch (error) {
        console.error("获取票务详情错误:", error);
        return res.json(util.fail("系统出现错误", error.message));
    }

}


