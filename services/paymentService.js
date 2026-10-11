/**
 * 支付宝支付服务（通用）
 * 封装支付宝 SDK 通用能力，所有业务（票务/酒店/套餐/停车/夏令等）共用
 *
 * 使用方式：
 *   const paymentService = require('../services/paymentService');
 *   const payUrl = await paymentService.createPagePay({ outTradeNo, subject, totalAmount });
 *
 * 注意：支付宝 SDK 实例全局单例，避免重复初始化
 */
const { AlipaySdk } = require('alipay-sdk');
const { alipayPZ } = require('../config/index');

// 单例 SDK 实例
const alipaySdk = new AlipaySdk({ ...alipayPZ });

class PaymentService {
    /**
     * PC 网站支付（alipay.trade.page.pay）
     * 返回支付页面 URL，前端直接 window.location.href 跳转
     *
     * @param {Object} params
     * @param {string} params.outTradeNo  商户订单号
     * @param {string} params.subject     订单标题
     * @param {string|number} params.totalAmount 订单金额（元）
     * @param {string} [params.body='商品详情']   订单描述
     * @param {string} [params.notifyUrl]  异步回调地址
     * @param {string} [params.returnUrl]  同步跳转地址
     * @returns {Promise<string>} 支付页面 URL
     */
    async createPagePay({ outTradeNo, subject, totalAmount, body = '商品详情', notifyUrl, returnUrl }) {
        const bizContent = {
            out_trade_no: outTradeNo,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            total_amount: totalAmount,
            subject: subject,
            body: body
        };

        return alipaySdk.pageExecute(
            'alipay.trade.page.pay',
            'GET',
            {
                bizContent, 
                notifyUrl, 
                returnUrl,
            }
        );
    }

    /**
     * 手机网站支付（alipay.trade.wap.pay）
     * 用于 H5/小程序场景
     *
     * @param {Object} params 同 createPagePay
     * @returns {Promise<string>} 支付页面 URL
     */
    async createWapPay({ outTradeNo, subject, totalAmount, body = '商品详情', notifyUrl, returnUrl }) {
        const bizContent = {
            out_trade_no: outTradeNo,
            product_code: 'QUICK_WAP_WAY',
            total_amount: totalAmount,
            subject: subject,
            body: body
        };

        return alipaySdk.pageExecute(
            'alipay.trade.wap.pay',
            'GET',
            {
                bizContent,
                notifyUrl,
                returnUrl,
            }
        );
    }

    /**
     * 验证支付宝异步回调签名
     * @param {Object} notifyBody 支付宝回调的 body（req.body）
     * @returns {boolean} 是否验签通过
     */
    verifyNotifySign(notifyBody) {
        return alipaySdk.checkNotifySign(notifyBody);
    }

    /**
     * 统一退款（alipay.trade.refund）
     *
     * @param {Object} params
     * @param {string} params.outTradeNo      商户订单号
     * @param {string} [params.tradeNo]      支付宝交易号（优先用）
     * @param {string|number} params.refundAmount 退款金额
     * @param {string} [params.refundReason] 退款原因
     * @param {string} params.outRequestNo   退款请求号（同一笔订单多次退款需唯一）
     * @returns {Promise<Object>} 支付宝退款结果
     */
    async refund({ outTradeNo, tradeNo, refundAmount, refundReason = '正常退款', outRequestNo }) {
        return alipaySdk.exec('alipay.trade.refund', {
            bizContent: {
                out_trade_no: outTradeNo,
                trade_no: tradeNo,
                refund_amount: refundAmount,
                refund_reason: refundReason,
                out_request_no: outRequestNo,
            }
        });
    }

    /**
     * 查询交易（alipay.trade.query）
     * 用于主动查询订单支付状态
     *
     * @param {Object} params
     * @param {string} [params.outTradeNo] 商户订单号
     * @param {string} [params.tradeNo]    支付宝交易号
     * @returns {Promise<Object>}
     */
    async queryTrade({ outTradeNo, tradeNo }) {
        return alipaySdk.exec('alipay.trade.query', {
            bizContent: {
                out_trade_no: outTradeNo,
                trade_no: tradeNo,
            }
        });
    }

    /**
     * 关闭交易（alipay.trade.close）
     * 用于订单超时未支付时主动关闭交易
     *
     * @param {Object} params
     * @param {string} [params.outTradeNo]
     * @param {string} [params.tradeNo]
     * @returns {Promise<Object>}
     */
    async closeTrade({ outTradeNo, tradeNo }) {
        return alipaySdk.exec('alipay.trade.close', {
            bizContent: {
                out_trade_no: outTradeNo,
                trade_no: tradeNo,
            }
        });
    }

    /**
     * 退款查询（alipay.trade.fastpay.refund.query）
     *
     * @param {Object} params
     * @param {string} [params.outTradeNo]
     * @param {string} [params.tradeNo]
     * @param {string} params.outRequestNo 退款请求号
     * @returns {Promise<Object>}
     */
    async queryRefund({ outTradeNo, tradeNo, outRequestNo }) {
        return alipaySdk.exec('alipay.trade.fastpay.refund.query', {
            bizContent: {
                out_trade_no: outTradeNo,
                trade_no: tradeNo,
                out_request_no: outRequestNo,
            }
        });
    }

    /**
     * 获取底层 SDK 实例（特殊场景需要时使用，不推荐常规使用）
     * @returns {AlipaySdk}
     */
    getSdk() {
        return alipaySdk;
    }
}

module.exports = new PaymentService();
