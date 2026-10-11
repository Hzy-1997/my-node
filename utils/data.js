/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */
// config/exportFields.js
const ORDER_STATUS_MAP = {
    1: '待支付',
    2: '待核销',
    3: '已取消',
    4: '已完成',
    5: '已退款'
};

const VERIFY_STATUS_MAP = {
    1: '未核销',
    2: '已核销',
    3: '已取消'
};

const HOTEL_STATUS_MAP = {
    1: '待支付',
    2: '待核销',
    3: '已取消',
    4: '已完成',
    5: '已退款'
};

// 门票订单导出字段配置
const ticketOrderFields = [
    { key: 'orderNumber', label: '订单号', width: 25 },
    { key: 'title', label: '票务名称', width: 20 },
    { key: 'ticketPrice', label: '票务价格', width: 12 },
    { key: 'userName', label: '用户名', width: 15 },
    { key: 'userPhone', label: '手机号', width: 15, decrypt: true },
    { key: 'userIdCard', label: '身份证', width: 20, decrypt: true },
    { key: 'buyNum', label: '购买数量', width: 12 },
    {
        key: 'orderStatus',
        label: '订单状态',
        width: 12,
        enum: ORDER_STATUS_MAP
    },
    {
        key: 'verifyStatus',
        label: '核销状态',
        width: 12,
        enum: VERIFY_STATUS_MAP
    },
    { key: 'orderAmount', label: '订单金额', width: 12 },
    { key: 'refundAmount', label: '退款金额', width: 12 },
    { key: 'playDate', label: '游玩日期', width: 15, date: true }
];

// 酒店订单导出字段配置
const hotelOrderFields = [
    { key: 'id', label: '订单ID', width: 10 },
    { key: 'title', label: '房间套餐', width: 20 },   // 统一字段名：原 key=roomName → key=title
    { key: 'orderNumber', label: '订单号', width: 25 },
    { key: 'userName', label: '用户姓名', width: 15 },
    { key: 'userPhone', label: '用户手机号', width: 15, decrypt: true },
    { key: 'userCard', label: '用户身份证号', width: 20, decrypt: true },
    { key: 'roomCount', label: '房间数量', width: 12 },
    { key: 'checkInDate', label: '入住日期', width: 15, date: true },
    { key: 'checkOutDate', label: '离店日期', width: 15, date: true },
    {
        key: 'status',
        label: '状态',
        width: 12,
        enum: HOTEL_STATUS_MAP
    },
    { key: 'amount', label: '订单金额', width: 12 },   // 注：excelData 已把 item.orderAmount 映射成 amount 键
    { key: 'unitPrice', label: '单位价格', width: 12 },
];

module.exports = {
    ORDER_STATUS_MAP,
    VERIFY_STATUS_MAP,
    HOTEL_STATUS_MAP,
    ticketOrderFields,
    hotelOrderFields
};