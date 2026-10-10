/*
 * @Descripttion:  通用的工具函数
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-22 09:49:18
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-07-30 15:26:19
 */

const crypto = require('crypto');  // 引入 Node.js 的内置加密模块
const ExcelJS = require("exceljs");
const { secretKey } = require("../config/index")
const { recordebug, recorderror, recordinfo } = require('./log4js.js'); // 引入封装的日志记录模块
const redisService = require("../services/redisService"); // 引入封装的 Redis 服务模块


const CODE = {
    SUCCESS: 200,          // 成功
    PARAM_ERROR: 101,        // 参数错误
    USER_ACCOUNT_ERROR: 201,     // 用户名或密码错误
    USER_LOGIN_ERROR: 301,     // 用户未登录
    BUSINESS_ERROR: 401,     // 业务请求错误
    AUTH_ERROR: 501,         // 授权错误 
}


/**
 * 格式化日期数据
 * @param {Array} dateStr - 包含日期数据的数组，可以是普通对象或Sequelize模型实例
 * @returns {Array} 返回格式化后的数据数组，如果输入不是数组则直接返回输入值
 */
function formDate(dateStr) {
    if (!Array.isArray(dateStr)) {
        return dateStr;
    }

    // 使用map方法处理数组中的每个元素
    let data = dateStr.map((item) => {
        // 处理Sequelize模型实例，先转换为普通对象
        const plainItem = item.toJSON ? item.toJSON() : item;

        // 返回新对象，展开原对象的所有属性，并格式化createdAt字段
        return {
            ...plainItem,
            createdAt: plainItem.createdAt ? formatTime(plainItem.createdAt) : null,
            updatedAt: plainItem.updatedAt ? formatTime(plainItem.updatedAt) : null,
            created_at: plainItem.created_at ? formatTime(plainItem.created_at) : null,
            updated_at: plainItem.updated_at ? formatTime(plainItem.updated_at) : null
        };
    });

    return data;
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}




/**
 * 生成单号
 * 格式: ORD + 日期(8位) + 用户ID(6位) + Redis自增(5位) + 时间戳后4位(4位)
 * 示例: ORD20250314000042000017890 
 * @returns {Promise<string>} 订单号
 */
async function generateOrderNo(beginning) {
    const prefix = beginning;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // 20250314 (8位)
    const seq = await redisService.incrFun(`order:seq:${date}`); // Redis自增
    const seqPart = String(seq).padStart(6, '0'); // 0000001 (6位)
    const timePart = Date.now().toString();
    return `${prefix}${date}${seqPart}${timePart}`;
}

/**
 * 生成核销编码（大写字母 + 数字）
 * @param {number} length - 编码长度，默认6位
 * @returns {string} 核销编码
 */
function generateWriteOffCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 格式化返回数据
function success(message = '', data = '', code = CODE.SUCCESS) {
    recordebug(data)
    return {
        code,
        data: formDate(data),
        message,
    }
}

// 格式化失败数据
function fail(message = '', data = '', code = CODE.BUSINESS_ERROR) {
    recordebug(message)
    return {
        code,
        data,
        message,
    }
}

// 格式化分页
function pager(pageNum = 1, pageSize = 10, sort = 'createdAt,DESC') {
    // 转换数字
    pageNum = parseInt(pageNum);
    pageSize = parseInt(pageSize);
    const skipIndex = (pageNum - 1) * pageSize;

    // 解析排序字段
    const [sortField, sortOrder] = sort.split(',');

    return {
        page: {
            pageNum,
            pageSize
        },
        skipIndex,
        order: [
            [sortField, sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC']
        ]
    };
}

// 加密
function encrypt(text) {
    const algorithm = 'aes-256-cbc';  // 使用的加密算法，AES，CBC模式
    const salt = crypto.randomBytes(16);  // 随机生成盐
    const iv = crypto.randomBytes(16);    // 随机生成IV
    // 使用PBKDF2生成密钥
    const key = crypto.pbkdf2Sync(secretKey, salt, 1000, 32, 'sha256'); // 生成32字节的密钥 （256位）

    const cipher = crypto.createCipheriv(algorithm, key, iv);  // 创建加密器
    let encrypted = cipher.update(text, 'utf8', 'hex'); // 加密文本，将结果转换为十六进制字符串
    encrypted += cipher.final('hex'); // 完成加密，将剩余的文本块加密并添加到结果中

    // 返回加密后的文本（格式：salt:iv:encrypted）
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted; // 用冒号分隔盐、IV 和加密数据
}

// 解密
function decrypt(encryptedText) {
    // 添加输入验证
    if (!encryptedText || typeof encryptedText !== 'string') {
        console.error('解密失败：输入无效');
        return encryptedText; // 如果输入无效，直接返回原值
    }
    const algorithm = 'aes-256-cbc'; // 使用的加密算法，AES，CBC模式
    try {
        // 提取salt、iv和加密数据
        const parts = encryptedText.split(':'); // 将加密文本和 IV 分开

        // 验证格式是否正确
        if (parts.length !== 3) {
            console.error('解密失败：格式错误，期望格式为 salt:iv:encrypted');
            return encryptedText; // 如果格式错误，直接返回原值
        }

        const salt = Buffer.from(parts[0], 'hex'); // 将 salt 从十六进制转换为 Buffer
        const iv = Buffer.from(parts[1], 'hex'); // 将 IV 从十六进制转换为 Buffer 
        const encrypted = parts[2];

        // 使用PBKDF2生成密钥
        const key = crypto.pbkdf2Sync(secretKey, salt, 1000, 32, 'sha256'); // 使用PBKDF2生成密钥
        const decipher = crypto.createDecipheriv(algorithm, key, iv); // 创建解密器
        let decrypted = decipher.update(encrypted, 'hex', 'utf8'); // 解密文本，将结果转换为 UTF-8 字符串
        decrypted += decipher.final('utf8'); // 完成解密，将剩余的文本块解密并添加到结果中
        console.log("解密后的密码11：", decrypted);
        return decrypted;
    } catch (error) {
        console.error('解密过程中发生错误:', error.message);
        return encryptedText; // 出错时返回原值
    }
}

// EXCEL模块
/**
 * 生成Excel文件
 * @param {Object} parameter - 参数对象
 * @param {string} parameter.title - 工作表标题
 * @param {Array} parameter.tabelHeader - 表头配置 [{ header: '列名', key: '字段名', width: 20 }]
 * @param {Array} parameter.data - 数据数组 [{ 字段名: 值 }]
 * @returns {Promise<Buffer>} - 返回Excel文件的Buffer
 */
async function excelFile(parameter) {
    const { title, tabelHeader, data } = parameter;
    let message = "参数错误"

    if (!Array.isArray(tabelHeader)) return message
    if (!Array.isArray(data)) return message

    // 1. 创建工作簿
    const workbook = new ExcelJS.Workbook();

    // 2. 添加工作表
    const worksheet = workbook.addWorksheet(title || 'Sheet1');

    // 3. 设置列（包含表头和宽度）
    worksheet.columns = tabelHeader.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15
    }));

    // 4. 设置表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }  // 蓝色背景
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. 添加数据
    data.forEach(item => {
        worksheet.addRow(item);
    });

    // 6. 添加边框
    worksheet.eachRow(row => {
        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: '000000' } },
                left: { style: 'thin', color: { argb: '000000' } },
                bottom: { style: 'thin', color: { argb: '000000' } },
                right: { style: 'thin', color: { argb: '000000' } }
            };
        });
    });

    // 7. 返回Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return {
        buffer,
        worksheet
    };
}


class ExportService {
    /**
     * 通用导出方法
     * @param {Object} options - 导出配置
     * @param {Array} options.fields - 字段映射配置
     * @param {String} options.title - 导出标题
     * @param {String} options.format - 导出格式 (xlsx/csv/json/pdf)
     */
    static async exportData(options) {
        const {
            fields = [],
            title = '数据导出',
            format = 'xlsx',
            data = [],
        } = options;

        console.log("传递过来的数据", options)

        // 2. 格式化数据
        let excelData = this.defaultFormat(data, fields);

        // 3. 构建导出数据结构
        const exportData = {
            title,
            tabelHeader: fields.map(f => ({
                header: f.label,
                key: f.key,
                width: f.width || 15
            })),
            data: excelData
        };

        // 4. 生成文件
        return await this.generateFile(exportData, format);
    }

    /**
     * 默认数据格式化
     */
    static defaultFormat(data, fields) {
        return data.map(item => {
            const row = {};
            fields.forEach(field => {
                let value = item[field.key];
                // 处理关联字段
                if (field.include) {
                    const keys = field.key.split('.');
                    value = item;
                    for (const key of keys) {
                        value = value ? value[key] : null;
                    }
                }
                // 处理枚举值
                if (field.enum) {
                    value = field.enum[value] || value;
                }
                // 处理日期
                if (field.date && value) {
                    value = formatTime(value);
                }
                // 处理解密
                if (field.decrypt && value) {
                    value = decrypt(value);
                }
                row[field.key] = value;
            });
            return row;
        });
    }

    /**
     * 生成文件（支持多种格式）
     */
    static async generateFile(data, format) {
        let buffer, contentType, fileExtension, fileName;

        switch (format) {
            case 'csv':
                buffer = this.generateCSV(data);
                contentType = 'text/csv; charset=utf-8';
                fileExtension = 'csv';
                break;

            case 'json':
                buffer = this.generateJSON(data);
                contentType = 'application/json; charset=utf-8';
                fileExtension = 'json';
                break;

            case 'xlsx':
            default:
                const result = await excelFile(data);
                buffer = result.buffer;
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileExtension = 'xlsx';
                break;
        }

        fileName = `${data.title}.${fileExtension}`;
        return { buffer, contentType, fileName };
    }

    /**
     * 生成CSV
     */
    static generateCSV(data) {
        const header = data.tabelHeader.map(h => h.header).join(',');
        const rows = data.data.map(row =>
            data.tabelHeader.map(h => {
                const value = row[h.key];
                if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );
        const csvContent = [header, ...rows].join('\n');
        return Buffer.from('\uFEFF' + csvContent, 'utf-8');
    }

    /**
     * 生成JSON
     */
    static generateJSON(data) {
        const jsonContent = JSON.stringify(data.data, null, 2);
        return Buffer.from(jsonContent, 'utf-8');
    }

    /**
     * 生成PDF（需要安装依赖）
     */
    static async generatePDF(data) {
        // 可集成 pdf-lib 或 pdfmake
        // 返回 Buffer
        return Buffer.from('PDF content', 'utf-8');
    }
}

module.exports = {
    CODE,
    success, fail, pager, encrypt, decrypt,
    formatTime,
    formDate,
    generateOrderNo,
    generateWriteOffCode,
    excelFile,
    ExportService
}