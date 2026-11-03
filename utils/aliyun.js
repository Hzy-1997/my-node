
const multer = require('multer');
const MAO = require('multer-aliyun-oss');
const OSS = require("ali-oss");
const path = require('path');
const { ACCESS_KEY_ID, ACCESS_KEY_SECRET, OSS_REGION, BUCKET_NAME } = require('../config/index.js');

// 阿里云配置信息
const config = {
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET_NAME,
    region: OSS_REGION,
    secure: true, // 使用 HTTPS
};

// 合法分类白名单，防止路径穿越
const ALLOWED_CATEGORIES = [
    'avatar', // 用户头像
    'ticket', // 票务图片
    'hotel', // 酒店图片
    'package', // 套餐图片
    'parking', // 停车图片
    'camp',  // 露营图片
    'activity', // 活动图片
    'strategy', // 策略图片
    'sport',  // 运动图片
    'relax', // 休闲图片
    'food', // 餐饮图片
    'shopping', // 购物图片
    "bus", // 观光车图片
    'feedback', // 反馈图片
    'service', // 游客服务图片
    'common'  // 通用图片
];

// 创建一个 OSS 客户端
const client = new OSS(config);

// 生成日期目录
function generateDatePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = ('0' + (now.getMonth() + 1)).slice(-2); // 保证两位数
    const day = ('0' + now.getDate()).slice(-2); // 保证两位数
    return `${year}/${month}/${day}`;
}

// multer 配置信息
const upload = multer({
    storage: MAO({
        config: config,
        // 修改上传目录为日期目录，自动创建按日期的目录结构
        destination: (req, file, cb) => {
            // 优先查询参数，其次路由参数，最后默认 common
            let category = req.query.category || req.params.category || 'common';
            // 白名单校验，非法值回退 common（也可直接报错）
            if (!ALLOWED_CATEGORIES.includes(category)) {
                category = 'common';
            }
            const datePath = generateDatePath();
            cb(null, `ceshiUp/${category}/${datePath}`);  // 上传路径为按日期生成的目录
        }
    }),
    limits: {
        fileSize: 2 * 1024 * 1024, // 限制上传文件的大小为：2MB
    },
    fileFilter: function (req, file, cb) {
        // 只允许上传图片
        const fileType = file.mimetype;
        if (fileType == 'image/png' || fileType == 'image/jpeg' || fileType == 'image/jpg') {
            return cb(null, true);
        } else {
            const err = new Error('只允许上传png/jpeg/jpg图片');
            err.status = 400;
            return cb(err);
        }
    }
});

// 定义一个中间件函数 fileSizeLimits，用于限制上传文件的大小
const fileSizeLimits = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);
    // 限制上传文件的大小为：2MB
    if (contentLength > 2 * 1024 * 1024) {
        return next("文件大小不能超过2MB");
    }
    next();
};

// 单文件上传，指定表单字段名为 file
const singleFileUpload = (req, res, next) => {
    // 检查文件大小是否超出限制
    fileSizeLimits(req, res, (err) => {
        if (err) return next(err);
        upload.single('file')(req, res, next);
    });
};

// 删除文件/图片
const deleteFile = async (req, res, next) => {
    const { fileKey } = req.body;  // 获取需要删除的文件的Key
    try {
        await client.delete(fileKey); // 删除文件
        res.status(200).json({ message: '文件删除成功' });
    } catch (err) {
        next(err);  // 错误处理
    }
};

const deleteImage = async (image) => {
    const result = await client.deleteMulti(image, { quiet: true });
    return result.res;
};

module.exports = {
    config,
    client,
    singleFileUpload,
    deleteFile,
    deleteImage,
};
