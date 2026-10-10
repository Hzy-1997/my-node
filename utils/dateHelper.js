/*
 * @描述: 日期相关工具函数
 * @日期: 2026-07-21
 */

const { format } = require('date-fns');

/**
 * 生成入住晚数对应的日期数组（不含退房日）
 *
 * 语义：酒店住 N 晚，对应 N 个日期（入住日 ~ 退房日前一天）
 * 例如 checkIn=2026-07-21, checkOut=2026-07-23 → ['2026-07-21', '2026-07-22']
 *
 * @param {Date|string} checkIn  入住日期
 * @param {Date|string} checkOut 退房日期
 * @returns {string[]} 日期字符串数组，格式 yyyy-MM-dd，不含退房日
 */
function generateNights(checkIn, checkOut) {
    const nights = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    // 归零时分秒，避免边界跳变
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (start < end) {
        nights.push(format(start, 'yyyy-MM-dd'));
        start.setDate(start.getDate() + 1);
    }
    return nights;
}

module.exports = {
    generateNights,
};
