const { post, get } = require("../../../utils/request");
const util = require("../../../utils/util");
const { eachDayOfInterval, format, isWeekend, parseISO, addDays } = require("date-fns");
const { holiday } = require("../../../models/Summary");


// 获取第三方日期数据
getThirdPartyData = async () => {
    try {
        const thisYear = new Date().getFullYear()
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
        res.json(util.fail("服务器内部错误", error.message));
    }
}



/**
 * 
 * @param {*} year  年份
 * @returns  获取指定年份的节假日数据
 */
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
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (!holidayData || holidayData.year <= currentYear) {
        if (currentMonth === 9) {
            await getThirdPartyData();
        }
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
            const maxEndDate = new Date(ruleStart);
            maxEndDate.setMonth(ruleStart.getMonth() + 3);

            if (ruleEnd > maxEndDate) {
                ruleEnd = maxEndDate;
            }
        }
        const ruleConfig = rule.ruleConfig; // 规则配置

        //处理当前日期范围的 三种日期状态：工作日、节假日、补班日
        const result = getWorkdaysAndHolidays(ruleStart, ruleEnd);

        // 根据日期类型和价格规则计算最终价格
        const ruleDatePrices = generateDatePrices(ticket, result, ruleConfig);

        // 将价格数据添加到结果中
        datePrices.push(...ruleDatePrices);

    }

    return datePrices.sort((a, b) => new Date(a.date) - new Date(b.date));
};

/**
 * 
 * @param {*} apiData  接口返回的假期数据
 * @returns  返回一个数组，包含所有放假日期和补班日期
 */
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

/**
 * 
 * @param {*} startDate  开始日期
 * @param {*} endDate    结束日期
 * @returns {Array}  返回一个数组，包含所有的工作日和假日
 */
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

/**
 * 
 * @param {*} basePrice  基础价格 
 * @param {*} dateType    日期类型 
 * @param {*} ruleConfig  规则配置 
 * @returns {Number}  返回计算后的价格
 */
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
            return Math.round(basePrice.price * (1 + priceValue / 100));
        case 3: // 百分比降价
            return Math.round(basePrice.price * (1 - priceValue / 100));
        case 4: // 原价
        default:
            return basePrice.price;
    }
}

/**
 * 
 * @param {*} basePrice   基础价格
 * @param {*} dateResult  日期结果对象，包含工作日、周末、节假日
 * @param {*} ruleConfig  价格规则配置
 * @returns  {Array}  返回日期价格数组
 */
function generateDatePrices(ticket, dateResult, ruleConfig) {

    const datePrices = [];

    // 处理工作日价格
    dateResult.workdays.forEach(dateStr => {
        const finalPrice = calculateDatePrice(ticket, 'weekday', ruleConfig);
        datePrices.push({
            id: ticket.id,
            date: dateStr,
            originalPrice: ticket.price, // 原价
            price: finalPrice, // 折扣后的价格
            stock: ticket.stock ? ticket.stock : 0, // 库存
            availableStock: ticket.stock ? ticket.stock : 0,
            dateType: 'workday',
            dateTypeName: '工作日'
        });
    });

    // 处理周末价格
    dateResult.weekends.forEach(dateStr => {
        const finalPrice = calculateDatePrice(ticket, 'weekend', ruleConfig);
        datePrices.push({
            id: ticket.id,
            date: dateStr,
            originalPrice: ticket.price,
            price: finalPrice,
            stock: ticket.stock,
            availableStock: ticket.stock ? ticket.stock : 0,
            dateType: 'weekend',
            dateTypeName: '周末'
        });
    });

    // 处理节假日价格
    dateResult.holidays.forEach(dateStr => {
        const finalPrice = calculateDatePrice(ticket, 'holiday', ruleConfig);
        datePrices.push({
            id: ticket.id,
            date: dateStr,
            originalPrice: ticket.price,
            price: finalPrice,
            stock: ticket.stock,
            availableStock: ticket.stock ? ticket.stock : 0,
            dateType: 'holiday',
            dateTypeName: '节假日'
        });
    });

    // 按日期排序
    return datePrices.sort((a, b) => new Date(a.date) - new Date(b.date));
}



module.exports = {
    calculateDatePrices,
    generateDatePrices,
};
