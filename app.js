/*
 * @Descripttion: 
 * @version: 
 * @Author: sueRimn
 * @Date: 2025-07-17 15:47:46
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2026-10-30 15:24:38
 */
console.log("当前环境：", process.env.NODE_ENV);
// 加载环境变量 - 支持开发、测试、生产环境
let envFile = '.env.development'; // 默认开发环境

if (process.env.NODE_ENV === 'production') {
  envFile = '.env.production';
} else if (process.env.NODE_ENV === 'test') {
  envFile = '.env.test';
}

console.log(`加载环境配置文件: ${envFile}, NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
require('dotenv').config({ path: envFile });

console.log('当前环境变量 NODE_ENV:', process.env.NODE_ENV);

var createError = require('http-errors');
var express = require('express');
const session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// 跨域模块
var cors = require('cors');

// 定时任务
const cron = require('node-cron');

const seckillPayment = require('./routes/managementSystem/payment/seckillPayment');
// 日志记录
const { logRequestMiddleware } = require('./utils/jwt');

// 引入路由接口
var indexRouter = require('./routes/index');
const { SESSION_ID } = require("./config/index")



var app = express();
// 跨域设置
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://8.136.33.92', 'https://hezhaoyuvip.cn', 'http://hezhaoyuvip.cn',], //允许的源
  credentials: true, //允许携带cookie
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',  //允许的请求类型
  preflightContinue: false,  //当出现options请求时，服务器端直接返回200，避免浏览器端出现preflight error
  optionsSuccessStatus: 204,  //当出现options请求时，服务器端直接返回204，避免浏览器端出现preflight error
  allowedHeaders: ['Authorization', 'Content-Type'], // 允许特定请求头
}))

// 配置 express-session
app.use(session({
  secret: SESSION_ID, // 用于加密 session ID 的密钥
  resave: false,             // 如果 session 没有修改，是否保存
  saveUninitialized: true,   // 如果 session 没有被初始化，是否保存
  cookie: {
    secure: false,     // HTTP 必须用 false
    httpOnly: true,    // 建议 true，更安全
    maxAge: 24 * 60 * 60 * 1000  // 24小时过期
  }
}));


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(logRequestMiddleware)
app.use('/api', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// 初始化Redis连接
async function initializeRedis() {
  try {
    console.log('Initializing Redis connection...');
    // 这里可以添加任何需要在启动时执行的Redis初始化逻辑
    // 例如从数据库加载初始数据到Redis缓存
    console.log('Redis connection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    // Redis连接失败不应该阻止应用启动，但应该记录错误
  }
}

// 初始化定时任务
function initializeCronJobs() {
  // 每天 00:30 执行库存重置（给30分钟缓冲，确保前一天订单已处理完）
  cron.schedule('30 0 * * *', async () => {
    console.log('[Cron] 执行每日库存重置...');
    try {
      const result = await seckillPayment.dailyReset();
      console.log('[Cron] 每日库存重置结果:', result);
    } catch (error) {
      console.error('[Cron] 每日库存重置失败:', error);
    }
  });

  // 全业务订单状态定时任务（每30秒扫描）：
  //   一、超时未支付自动取消（payStatus=5 + 回补库存，支付宝不回调时的 DB 对账兜底）
  //   二、已支付订单超使用期未核销 → verifyStatus=3 已过期；夏令营结营 → payStatus 2→3
  // require('./tasks/orderExpireTask').start();

  console.log('[Cron] 定时任务已初始化，每天 00:30 执行库存重置，每30秒扫描订单状态');
}

// 导出初始化函数供www文件使用
module.exports = {
  app,
  initializeRedis,
  initializeCronJobs
};
