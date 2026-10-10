const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");

const { hotelOrderFields } = require("../../../utils/data")
const { eachDayOfInterval, format, isWeekend, parseISO, addDays } = require("date-fns");
const { calculateDatePrices } = require("../ADateConfiguration/index");
const { verifyToken } = require("../../../utils/jwt");

// 首先引入所有模型
const { Hotel, RoomType, RoomPackage, RoomDatePrice, RoomPriceRule, RoomInventory, HotelOrder, holiday, Member, WriteOff, RefundOrder } = require("../../../models/Summary");

const hotelPurchaseService = require("../../../services/hotelPurchaseService");
const queueService = require("../../../services/queueService");
const redisService = require("../../../services/redisService");


// 酒店操作
exports.hotelListOperation = async (req, res) => {
    try {
        let { id, action, title } = req.body;
        if (!action) return res.json(util.fail('缺少必要参数'));

        if (action === 'create') {
            if (!title) return res.json(util.fail('缺少必要参数'));
            let hotelState = await Hotel.findOne({ where: { title: title } });
            if (hotelState) return res.json(util.fail('酒店已存在'));
            let state = await Hotel.create(req.body);
            if (!state) return res.json(util.fail('创建失败'));
            return res.json(util.success('创建成功'));

        } else if (action === 'update') {
            let { id } = req.body;
            if (!id) return res.json(util.fail('缺少必要参数'));

            let state = await Hotel.update(req.body, { where: { id: id } });
            if (!state) return res.json(util.fail('更新失败'));
            return res.json(util.success('更新成功'));
        } else if (action === 'delete') {
            let state = await Hotel.destroy({ where: { id: id } });
            if (!state) return res.json(util.fail('删除失败'));
            return res.json(util.success('删除成功'));
        }
    } catch (error) {

        res.json(util.fail(error.message))
    }

}

// 获取酒店列表
exports.getHotelList = async (req, res) => {
    try {
        const { title, status, page = 1, pageSize = 10 } = req.query;

        // 构建基础查询参数
        const queryOptions = {
            limit: parseInt(pageSize),
            offset: (parseInt(page) - 1) * parseInt(pageSize),
            order: [['id', 'DESC']]
        };

        // 只有在有查询条件时才添加where对象
        if (title || status) {
            queryOptions.where = {};
            if (title) queryOptions.where.title = { [Op.like]: `%${title}%` };
            if (status) queryOptions.where.status = parseInt(status);
        }

        let list = await Hotel.findAndCountAll(queryOptions);
        list.rows = util.formDate(list.rows);
        let data = {
            list: list.rows,
            count: list.count,
            page,
            pageSize
        }

        return res.json(util.success('获取成功', data));

    } catch (error) {
        console.error("获取酒店列表错误:", error);
        return res.json(util.fail("服务器内部错误", error.message));
    }
}

// 房型操作接口
exports.hotelRoomTypeOperation = async (req, res) => {
    try {
        let { action, stock, name, hotelId } = req.body;

        if (!action) return res.json(util.fail('缺少必要参数'));

        if (action === 'create') {


            if (!name) return res.json(util.fail('缺少必要参数'));
            if (!hotelId) return res.json(util.fail('缺少必要参数'));

            let stateHotel = await Hotel.findOne({ where: { id: hotelId } })
            if (!stateHotel) return res.json(util.fail("添加失败，酒店类型错误"))

            let roomTypeState = await RoomType.findOne({ where: { name: name } });
            if (roomTypeState) return res.json(util.fail('房型已存在'));

            let state = await RoomType.create(req.body);
            if (!state) return res.json(util.fail('创建失败'));
            return res.json(util.success('创建成功'));

        } else if (action === 'update') {
            let { id, stock } = req.body;
            if (!id) return res.json(util.fail('缺少必要参数'));


            if (hotelId) {
                let stateHotel = await Hotel.findOne({ where: { id: hotelId } })
                if (!stateHotel) return res.json(util.fail("修改失败，酒店类型错误"))
            }

            // 获取更新前的房型信息（用于比较库存是否变化）
            const originalRoomType = await RoomType.findOne({ where: { id: id } });
            if (!originalRoomType) return res.json(util.fail('房型不存在'));

            let state = await RoomType.update(req.body, { where: { id: id } });
            if (!state) return res.json(util.fail('更新失败'));

            // 更新库存：如果库存发生变化，同步更新该房型下所有套餐的每日库存
            if (stock !== undefined && stock !== originalRoomType.stock) {
                await updateRoomTypeStock(id, stock);
            }

            return res.json(util.success('更新成功'));

        } else if (action === "delete") {

            if (!id) return res.json(util.fail('缺少必要参数'));

            let state = await RoomType.destroy({ where: { id: id } })

            if (!state) return res.json(util.fail('删除失败'));

            return res.json(util.success('删除成功'));

        }
    } catch (error) {
        return res.json(util.fail(error.message));
    }

}
// 房型列表接口
exports.getRoomTypeList = async (req, res) => {
    try {
        const { name, page = 1, pageSize = 10 } = req.query;


        let includeOptions = [
            {
                model: Hotel,
                as: 'hotel',
                attributes: ['id', 'title',],
            }
        ];


        // 构建基础查询参数
        const queryOptions = {
            limit: parseInt(pageSize),
            offset: (parseInt(page) - 1) * parseInt(pageSize),
            order: [['id', 'DESC']]
        };

        if (name) {
            queryOptions.where = {};
            queryOptions.where.name = { [Op.like]: `%${name}%` };
        }
        let list = await RoomType.findAndCountAll({
            include: includeOptions,
            ...queryOptions
        })

        list.rows = util.formDate(list.rows);
        let data = {
            list: list.rows,
            count: list.count,
            page,
            pageSize,
        }
        return res.json(util.success("获取成功", data));

    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

// 套餐操作接口
exports.hotelPackageOperation = async (req, res) => {
    const { id, action, name, roomTypeId, hotel_id } = req.body;
    try {
        if (!action) return res.json(util.fail('缺少必要参数'));

        if (action === 'create') {
            if (!name) return res.json(util.fail('缺少必要参数'));
            if (!roomTypeId) return res.json(util.fail('缺少必要参数'));

            let roomPackageState = await RoomPackage.findOne({ where: { name: name } });
            if (roomPackageState) return res.json(util.fail('套餐已存在'));

            let state = await RoomPackage.create(req.body);
            if (!state) return res.json(util.fail('创建失败'));
            return res.json(util.success('创建成功'));
        } else if (action === 'update') {
            if (!id) return res.json(util.fail('缺少必要参数'));
            if (!roomTypeId) return res.json(util.fail('缺少必要参数'));
            // let roomPackageState = await RoomPackage.findOne({ where: { name: name } });
            // if (roomPackageState) return res.json(util.fail('名称已存在'));
            let state = await RoomPackage.update(req.body, { where: { id: id } });
            if (!state) return res.json(util.fail('更新失败'));
            return res.json(util.success('更新成功'));
        } else if (action === 'delete') {
            let state = await RoomPackage.destroy({ where: { id: id } });
            if (!state) return res.json(util.fail('删除失败'));
            return res.json(util.success('删除成功'));

        }
    } catch (error) {

        return res.json(util.fail('操作失败'));
    }
}
// 获取套餐列表
exports.getRoomPackageList = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, name, hotelId } = req.query;

        // 构建查询条件
        let where = {};
        if (name) where.name = { [Op.like]: `%${name}%` };

        let includeOptions = [
            {
                model: RoomType,
                as: 'roomType',
                attributes: ['id', 'name', 'description', 'stock'],
                include: [
                    {
                        model: Hotel,
                        as: 'hotel',
                        attributes: ['id', 'title', 'address', 'phone', 'star_rating']
                    }
                ]
            }
        ];

        if (hotelId) {
            includeOptions[0].where = { hotel_id: parseInt(hotelId) };
            includeOptions[0].required = true;
        }

        // 查询套餐列表
        const { count, rows } = await RoomPackage.findAndCountAll({
            where,
            include: includeOptions,
            attributes: ['id', 'name', 'price', 'startDate', 'endDate', 'roomTypeId', 'status', 'createdAt', 'includes'],
            limit: parseInt(pageSize),
            offset: (parseInt(page) - 1) * parseInt(pageSize),
            order: [['created_at', 'DESC']]
        });

        let list = util.formDate(rows); // 格式化日期

        return res.json(util.success('查询成功', {
            list: list,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(pageSize))
        }));

    } catch (error) {
        console.error('查询套餐列表失败:', error);
        return res.json(util.fail('查询失败', error.message));
    }
}

// 配置价格规则
exports.setDatePrice = async (req, res) => {
    try {
        const { action, roomPackageId, ruleConfig } = req.body;
        if (!action) return res.json(util.fail('缺少必要参数'));
        if (!ruleConfig) return res.json(util.fail('缺少必要参数'));

        if (action === 'create') {
            if (!roomPackageId) return res.json(util.fail('缺少必要参数'));
            // 顺道配置价格规则
            let comboState = await RoomPackage.findOne({ where: { id: roomPackageId } });

            if (!comboState) return res.json(util.fail('套餐不存在'));
            if (comboState.state == 2) return res.json(util.fail('套餐已下架'));

            // 检查是否已存在价格规则
            let existingRule = await RoomPriceRule.findOne({
                where: { roomPackageId: roomPackageId }
            });

            if (existingRule) {
                // 如果已存在，则更新规则
                await RoomPriceRule.update(req.body, {
                    where: { roomPackageId: roomPackageId }
                });
            } else {
                // 如果不存在，则创建新规则
                await RoomPriceRule.create(req.body);
            }

            // 顺道配置价格规则
            let combo = await RoomPackage.findOne({
                where: { id: roomPackageId },
                attributes: ['id', 'name', 'price', 'startDate', 'endDate', 'status'],
                include: [
                    {
                        model: RoomType,
                        as: 'roomType',
                        attributes: ['id', 'name', 'stock']
                    },
                    {
                        model: RoomPriceRule,
                        as: 'priceRule',
                        attributes: ['id', 'ruleConfig']
                    },

                ]
            });

            if (!combo || !combo.priceRule) return res.json(util.fail('创建失败,联系管理员'));

            let priceData = {
                id: combo.id,  // 套餐id
                startDate: combo.startDate,  // 开始时间
                endDate: combo.endDate, // 结束时间
                price: combo.price, // 价格
                stock: combo.roomType.stock,  // 库存
                // 将单个对象转换为数组
                priceRules: combo.priceRule ? [{
                    startDate: combo.startDate,  // 开始时间
                    endDate: combo.endDate, // 结束时间
                    id: combo.priceRule.id, // 规则id
                    ruleConfig: combo.priceRule.ruleConfig, // 规则配置
                }] : []
            }

            // 使用 bulkCreate 批量插入
            let DatePriceList = await calculateDatePrices(priceData, priceData.priceRules)
            // return res.json(util.success('创建成功,价格生成成功'));
            if (!DatePriceList) return res.json(util.fail('操作失败,联系管理员'));

            // 转换数据格式为数据库字段名
            const records = DatePriceList.map(item => ({
                roomPackageId: item.id,
                date: item.date,
                price: item.price,
                priceType: 1, // 规则价格
                stock: item.stock || 0,
                sold_stock: 0,
                availableStock: item.availableStock || item.stock || 0,
                status: 1
            }));

            const result = await RoomDatePrice.bulkCreate(records, {
                updateOnDuplicate: ['price', 'price_type', 'stock', 'sold_stock', 'available_stock', 'status', 'updated_at']
            });
            if (!result) return res.json(util.fail('操作失败,联系管理员'));

            // 写入房型共享库存（RoomInventory，按 roomTypeId + date 唯一）
            // 逻辑：只插入不存在的日期，已存在的不覆盖（库存是房型共享的，第一个套餐创建即可）
            const roomTypeId = combo.roomType.id;
            const roomTypeStock = combo.roomType.stock;
            // 同一房型的多个套餐会重复生成相同日期，按 date 去重
            const dateSet = new Set();
            DatePriceList.forEach(item => {
                const dateStr = item.date instanceof Date
                    ? format(item.date, 'yyyy-MM-dd')
                    : item.date;
                dateSet.add(dateStr);
            });
            const allDates = Array.from(dateSet);

            // 查询该房型已存在的日期库存记录
            const existingInventories = await RoomInventory.findAll({
                where: {
                    roomTypeId: roomTypeId,
                    date: { [Op.in]: allDates }
                },
                attributes: ['date']
            });
            const existingDates = new Set(existingInventories.map(inv => inv.date));

            // 只插入不存在的日期
            const missingDates = allDates.filter(d => !existingDates.has(d));
            if (missingDates.length > 0) {
                const inventoryRecords = missingDates.map(date => ({
                    roomTypeId,
                    date,
                    stock: roomTypeStock,
                    soldStock: 0,
                    availableStock: roomTypeStock
                }));
                await RoomInventory.bulkCreate(inventoryRecords);
                console.log(`[setDatePrice] 房型${roomTypeId} 新增 ${missingDates.length} 天库存: ${missingDates.join(', ')}`);
            } else {
                console.log(`[setDatePrice] 房型${roomTypeId} 所选日期库存已存在，跳过`);
            }

            return res.json(util.success('创建成功,价格生成成功'));
        } else if (action === 'update') {


        }
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}
// 查询价格规则
exports.getPriceRule = async (req, res) => {
    try {
        const { id } = req.query
        let inform = await RoomPriceRule.findOne({
            where: { roomPackageId: id }
        })

        // 如果查询不到数据，返回默认值或空对象
        if (!inform) {
            return res.json(util.success('查询成功，未找到对应规则'));
        }

        return res.json(util.success('查询成功', inform));
    } catch (error) {
        console.error('查询价格规则错误:', error);
        return res.json(util.fail('查询失败: ' + error.message));
    }
}

// 查询日期价格
exports.getDatePrice = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.json(util.fail('缺少必要参数'));

        // 价格从 RoomDatePrice 取（按套餐）
        const prices = await RoomDatePrice.findAll({
            where: { roomPackageId: id },
            attributes: ['id', 'date', 'price', 'priceType', 'status']
        });
        if (!prices || prices.length === 0) {
            return res.json(util.success('获取成功', []));
        }

        // 库存从 RoomInventory 取（按房型共享）
        const pkg = await RoomPackage.findOne({ where: { id }, attributes: ['roomTypeId'] });
        let inventoryMap = {};
        if (pkg && pkg.roomTypeId) {
            const inventories = await RoomInventory.findAll({
                where: {
                    roomTypeId: pkg.roomTypeId,
                    date: { [Op.in]: prices.map(p => p.date) }
                },
                attributes: ['date', 'stock', 'soldStock', 'availableStock']
            });
            inventories.forEach(inv => { inventoryMap[inv.date] = inv; });
        }

        // 按 date 合并价格 + 库存
        const data = prices.map(p => {
            const inv = inventoryMap[p.date] || {};
            return {
                id: p.id,
                date: p.date,
                price: p.price,
                priceType: p.priceType,
                status: p.status,
                stock: inv.stock || 0,
                soldStock: inv.soldStock || 0,
                availableStock: inv.availableStock || 0
            };
        });
        return res.json(util.success('获取成功', data));
    } catch (error) {
        return res.json(util.fail("服务器内部错误", error.message));
    }
}

// 修改单个价格日期（仅更新价格相关字段，不碰库存）
exports.updateDatePrice = async (req, res) => {
    try {
        const { id, price, priceType, status } = req.body
        if (!id || !price || !priceType) return res.json(util.fail('缺少必要参数'));
        let state = await RoomDatePrice.findOne({ where: { id } })
        if (!state) return res.json(util.fail('出现错误，未修改成功'));

        // 白名单字段，防止误写库存
        await RoomDatePrice.update(
            { price, priceType, status },
            { where: { id } }
        )
        return res.json(util.success('修改成功'));

    } catch (error) {

        return res.json(util.fail("系统内部错误", error.message));
    }
}

/**
 * 更新房型库存时，同步更新房型每日共享库存（RoomInventory）
 * 双写期：同时更新 RoomDatePrice（第三阶段删除 RoomDatePrice 双写逻辑）
 * @param {Number} roomTypeId - 房型ID
 * @param {Number} newStock - 新房型库存
 */
const updateRoomTypeStock = async (roomTypeId, newStock) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = format(today, 'yyyy-MM-dd');

        // 1. 主：更新 RoomInventory（房型共享库存，按 roomTypeId + date）
        //    availableStock = GREATEST(0, newStock - soldStock)，不重置已售
        await RoomInventory.update(
            {
                stock: newStock,
                availableStock: Sequelize.literal(`GREATEST(0, ${Number(newStock)} - sold_stock)`)
            },
            {
                where: {
                    roomTypeId: roomTypeId,
                    date: { [Op.gte]: todayStr }
                }
            }
        );

        // 2. 双写：同步更新 RoomDatePrice（过渡期保留，第三阶段删除）
        const packages = await RoomPackage.findAll({
            where: { roomTypeId: roomTypeId, status: 1 },
            attributes: ['id']
        });
        if (packages && packages.length > 0) {
            const packageIds = packages.map(pkg => pkg.id);
            const datePrices = await RoomDatePrice.findAll({
                where: {
                    roomPackageId: { [Op.in]: packageIds },
                    date: { [Op.gte]: todayStr }
                },
                attributes: ['id', 'soldStock']
            });
            for (const record of datePrices) {
                const soldStock = record.soldStock || 0;
                const availableStock = Math.max(0, newStock - soldStock);
                await RoomDatePrice.update(
                    { stock: newStock, availableStock: availableStock },
                    { where: { id: record.id } }
                );
            }
        }

    } catch (error) {
        console.error(`❌ 更新房型 ${roomTypeId} 库存失败:`, error);

    }
};

// 酒店房型预定接口
exports.hotelRoomBook = async (req, res) => {
    const startTime = Date.now();
    const { goodsId, roomTypeId, count, userId, startDate, endDate, expectedAmount, userCard } = req.body;
    if (!goodsId || !roomTypeId || !count || !userId || !startDate || !endDate) {
        return res.json(util.fail('缺少必要参数'));
    }
    try {




        const roomType = await RoomType.findByPk(roomTypeId);
        if (!roomType) {
            return res.json(util.fail('房型不存在'));
        }

        const user = await Member.findByPk(userId);
        if (!user) {
            return res.json(util.fail('用户不存在'));
        }

        const roomPackage = await RoomPackage.findByPk(goodsId);
        if (!roomPackage) {
            return res.json(util.fail('套餐不存在'));
        }

        // 计算需要检查的每晚日期
        const nights = getNightsToCheck(startDate, endDate);

        if (nights.length === 0) {
            return res.json(util.fail('入住日期错误'));
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkInDate = new Date(startDate);
        checkInDate.setHours(0, 0, 0, 0);
        if (checkInDate < today) {
            return res.json(util.fail('入住日期不能小于当前日期'));
        }

        // 校验房型/套餐状态
        if (roomType.status != 1) return res.json(util.fail('房型不可用'));
        if (roomPackage.status != 1) return res.json(util.fail('套餐不可用'));

        // 查询每日价格并校验每晚都已配价
        const roomDatePrices = await RoomDatePrice.findAll({
            where: {
                roomPackageId: roomTypeId,
                date: { [Op.in]: nights }
            }
        });
        console.log("日期", roomDatePrices)
        const priceMap = {};
        roomDatePrices.forEach(p => { priceMap[p.date] = Number(p.price); });
        console.log("priceMap", priceMap);
        const missingPrice = nights.filter(d => priceMap[d] == null);
        if (missingPrice.length > 0) {
            // return res.json(util.fail(`以下日期未配置价格: ${missingPrice.join('、')}`));
            return res.json(util.fail(`以下日期暂无可售: ${missingPrice.join('、')}`));
        }
        const unitPrice = nights.reduce((sum, d) => sum + priceMap[d], 0); // 每间整段总价
        const totalPrice = unitPrice * count;

        // 生成订单号
        const orderNo = await util.generateOrderNo('ORDHD');

        // ========== Redis 库存预热 + Lua 原子扣减（多晚一次性扣减，全成功或全失败） ==========
        let purchaseResult;
        try {
            purchaseResult = await hotelPurchaseService.purchaseHotel({
                roomPackageId: goodsId,
                roomTypeId,
                quantity: count,
                userId,
                orderNo,
                checkIn: startDate,
                checkOut: endDate
            });
        } catch (e) {
            return res.json(util.fail('库存扣减失败: ' + e.message));
        }
        if (!purchaseResult.success) {
            return res.json(util.fail(purchaseResult.message || '库存不足'));
        }

        // ========== 落订单（待支付），失败则回滚 Redis 库存 ==========
        try {
            await HotelOrder.create({
                orderNumber: orderNo,
                userId,
                userPhone: user.phone,
                userName: user.userName,
                userCard: userCard ? userCard : user.userCard,
                transactionNumber: orderNo,
                roomId: roomPackage.id,
                title: roomPackage.name,    // 统一字段名：原 roomName → title
                roomTypeId,
                roomCount: count,
                checkInDate: startDate,
                checkOutDate: endDate,
                status: 1,            // 1-待支付
                orderAmount: totalPrice,    // 统一字段名：原 amount → orderAmount
                unitPrice,
                totalPrice,
                verifyCode: orderNo
            });
        } catch (e) {
            // 订单落库失败，回滚已扣减的 Redis 库存
            await hotelPurchaseService.refundHotel({
                roomPackageId: goodsId,
                roomTypeId,
                quantity: count,
                checkIn: startDate,
                checkOut: endDate
            }).catch(err => console.error('酒店订单回滚库存失败:', err.message));
            return res.json(util.fail('订单创建失败: ' + e.message));
        }

        // 缓存订单到 Redis（供支付回调和取消任务使用）
        await redisService.setFun(`order:${orderNo}`, {
            orderNumber: orderNo,
            isHotelOrder: true,
            roomPackageId: goodsId,
            roomTypeId,
            userId,
            count,
            nights,
            unitPrice,
            totalPrice,
            checkIn: startDate,
            checkOut: endDate
        }, 600);

        // 延迟取消任务（10 分钟未支付自动取消并恢复库存）
        await queueService.addCancelJob({
            orderNo,
            isHotelOrder: true,
            roomPackageId: goodsId,
            roomTypeId,
            userId,
            count,
            checkIn: startDate,
            checkOut: endDate,
            nights,
            reason: '超时未支付'
        });

        return res.json(util.success('订单创建成功，请尽快支付', {
            orderNo,
            verifyCode: orderNo,
            unitPrice,
            totalPrice,
            expireTime: Date.now() + 10 * 60 * 1000
        }));

    } catch (error) {

        return res.json(util.fail("系统内部错误", error.message));
    }
}

// 需要检查库存的日期范围：[startDate, endDate) 不包括离店日期（endDate）
function getNightsToCheck(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current < end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// 
exports.getHotelOrderList = async (req, res) => {
    let { orderNumber, userPhone, userCard, status, startDate, endDate, pageSize = 10, pageNumber = 1 } = req.query
    pageSize = parseInt(pageSize)
    pageNumber = parseInt(pageNumber)

    try {
        let where = {}

        if (orderNumber) where.orderNumber = { [Op.like]: `%${orderNumber}%` }
        if (userPhone) where.userPhone = { [Op.like]: `%${userPhone}%` }
        if (userCard) where.userCard = { [Op.like]: `%${userCard}%` }
        if (status) where.status = status
        if (startDate || endDate) {
            where.createdAt = {
                [Op.between]: [startDate, endDate],
            };
        }



        let { rows, count } = await HotelOrder.findAndCountAll({
            where: where,
            offset: (pageNumber - 1) * pageSize,
            limit: pageSize,
            order: [['id', 'DESC']]
        })


        rows.map((item) => {
            item.userPhone = util.encrypt(item.userPhone);
            item.userCard = util.encrypt(item.userCard)
        })


        let data = {
            rows,
            count,
            pageSize,
            pageNumber,
        }

        return res.json(util.success("获取成功", data))

    } catch (error) {
        return res.json(util.fail("获取失败", error.message))
    }
}


// ==================== 酒店核销员管理（复用 write_offs 表，type=2） ====================

// 酒店核销员操作（创建/更新/删除）
exports.hotelWriteOffOperate = async (req, res) => {
    try {
        const { id, phone, action } = req.body
        if (!action) return res.json(util.fail('缺少必要参数'))
        if (!phone) return res.json(util.fail('手机号不能为空'))

        if (action === "create") {
            // 同手机号 + 酒店类型 唯一
            const existence = await WriteOff.findOne({ where: { phone, type: 2 } })
            if (existence) return res.json(util.fail('当前手机号已绑定酒店核销员'))

            // 从 token 解析操作人
            let operator = ""
            let token = req.headers['authorization'];
            if (token) {
                token = token.replace(/^Bearer\s+/i, '').trim();
                try {
                    const userInfo = await verifyToken(token);
                    operator = `${userInfo.username}-${userInfo.account}`;
                } catch (e) { }
            }

            await WriteOff.create({ ...req.body, type: 2, operator })
            return res.json(util.success('创建成功'))

        } else if (action === "update") {
            if (!id) return res.json(util.fail('缺少必要参数'))
            // 保证 type 不被改写
            const updateBody = { ...req.body, type: 2 }
            await WriteOff.update(updateBody, { where: { id, type: 2 } })
            return res.json(util.success('更新成功'))

        } else if (action === "delete") {
            if (!id) return res.json(util.fail('缺少必要参数'))
            await WriteOff.destroy({ where: { id, type: 2 } })
            return res.json(util.success('删除成功'))
        } else {
            return res.json(util.fail('未知操作类型'))
        }
    } catch (error) {
        return res.json(util.fail("操作失败", error.message))
    }
}

// 酒店核销员列表
exports.getHotelWriteOffList = async (req, res) => {
    try {
        const { page = 1, pageSize = 10, phone = "" } = req.query

        let where = { type: 2 } // 酒店核销员
        if (phone) {
            where.phone = { [Op.like]: `%${phone}%` }
        }
        const { rows, count } = await WriteOff.findAndCountAll({
            where,
            offset: (parseInt(page) - 1) * parseInt(pageSize),
            limit: parseInt(pageSize),
            order: [['id', 'DESC']]
        })

        const formattedRows = util.formDate(rows)
        return res.json(util.success("获取成功", { rows: formattedRows, count }))
    } catch (error) {
        return res.json(util.fail("获取失败", error.message))
    }
}


// ==================== 酒店订单核销（核销码核销） ====================

/**
 * 核销酒店订单
 * 入参：verifyCode（核销码，下单时等于 orderNumber）或 orderNumber
 * 逻辑：
 *   - 仅 status=2（已支付/待核销）且 verifyStatus=1（待核销）可核销
 *   - 核销后：verifyStatus=2（已核销）、status=4（已完成）、记录核销时间
 */
exports.hotelVerifyOrder = async (req, res) => {
    try {
        const { verifyCode, orderNumber, writeOffPhone } = req.body
        const code = verifyCode || orderNumber
        if (!code) return res.json(util.fail('请输入核销码/订单号'))

        // 1. 查订单
        const order = await HotelOrder.findOne({
            where: {
                [Op.or]: [{ verifyCode: code }, { orderNumber: code }]
            }
        })
        if (!order) return res.json(util.fail('订单不存在，核销码无效'))

        // 2. 校验订单状态
        if (order.status !== 2) {
            const statusText = { 1: '待支付', 3: '已取消', 4: '已完成', 5: '已退款' }[order.status] || '当前'
            return res.json(util.fail(`订单状态不可核销（${statusText}）`))
        }
        if (order.verifyStatus === 2) return res.json(util.fail('订单已核销，请勿重复核销'))
        if (order.verifyStatus === 3) return res.json(util.fail('订单已取消核销'))

        // 3. 校验核销员（若传了 writeOffPhone，需是启用的酒店核销员）
        let writeOffRecord = null
        if (writeOffPhone) {
            writeOffRecord = await WriteOff.findOne({ where: { phone: writeOffPhone, type: 2, status: 1 } })
            if (!writeOffRecord) return res.json(util.fail('核销员不存在或已停用'))
        }

        // 4. 核销：更新订单
        await HotelOrder.update(
            { verifyStatus: 2, status: 4, verifyTime: new Date() },
            { where: { id: order.id } }
        )

        // 5. 更新核销员今日核销次数和最后核销时间
        if (writeOffRecord) {
            await WriteOff.update(
                {
                    todayWriteOff: (writeOffRecord.todayWriteOff || 0) + 1,
                    lastWriteOffTime: new Date()
                },
                { where: { id: writeOffRecord.id } }
            )
        }

        return res.json(util.success('核销成功', {
            orderNumber: order.orderNumber,
            roomName: order.title,           // 统一字段名：原 order.roomName → order.title
            userName: order.userName,
            checkInDate: order.checkInDate,
            checkOutDate: order.checkOutDate,
            roomCount: order.roomCount,
            totalPrice: order.totalPrice
        }))
    } catch (error) {
        return res.json(util.fail("核销失败", error.message))
    }
}

/**
 * 核销码查询订单（核销前预览订单信息，不修改状态）
 */
exports.hotelQueryByVerifyCode = async (req, res) => {
    try {
        const { verifyCode, orderNumber } = req.query
        const code = verifyCode || orderNumber
        if (!code) return res.json(util.fail('请输入核销码/订单号'))

        const order = await HotelOrder.findOne({
            where: {
                [Op.or]: [{ verifyCode: code }, { orderNumber: code }]
            },
            attributes: ['orderNumber', 'userName', 'userPhone', 'title', 'roomCount',
                'checkInDate', 'checkOutDate', 'totalPrice', 'status', 'verifyStatus', 'verifyTime', 'paymentTime']
        })
        if (!order) return res.json(util.fail('订单不存在，核销码无效'))

        return res.json(util.success("查询成功", order))
    } catch (error) {
        return res.json(util.fail("查询失败", error.message))
    }
}


// ==================== 酒店退款订单列表 ====================

/**
 * 酒店退款预览（不修改任何状态，仅计算退款金额和扣款规则）
 * 供前端点击退款按钮时弹窗确认使用
 *
 * Query: orderNumber
 * 返回: { totalPrice, refundAmount, deductionAmount, refundRate, rule, canRefund, forceRefundable }
 */
exports.hotelRefundPreview = async (req, res) => {
    try {
        const { orderNumber } = req.query
        if (!orderNumber) return res.json(util.fail('订单号不能为空'))

        const order = await HotelOrder.findOne({
            where: { orderNumber },
            attributes: ['orderNumber', 'status', 'verifyStatus', 'totalPrice', 'checkInDate', 'title', 'userName']
        })
        if (!order) return res.json(util.fail('订单不存在'))

        // 计算日期差
        const checkIn = new Date(order.checkInDate)
        const today = new Date()
        checkIn.setHours(0, 0, 0, 0)
        today.setHours(0, 0, 0, 0)
        const diffDays = Math.round((checkIn - today) / (1000 * 60 * 60 * 24))

        // 阶梯规则
        let refundRate, deductionRate, rule, canRefund
        if (diffDays >= 5) {
            refundRate = 1.0; deductionRate = 0.0; canRefund = true
            rule = `入住前${diffDays}天-免费取消`
        } else if (diffDays === 4) {
            refundRate = 0.7; deductionRate = 0.3; canRefund = true
            rule = '入住前4天-扣30%'
        } else if (diffDays === 3) {
            refundRate = 0.5; deductionRate = 0.5; canRefund = true
            rule = '入住前3天-扣50%'
        } else if (diffDays === 2) {
            refundRate = 0.2; deductionRate = 0.8; canRefund = true
            rule = '入住前2天-扣80%'
        } else {
            refundRate = 0; deductionRate = 1.0; canRefund = false
            rule = `入住前${diffDays}天-不可退款`
        }

        const refundAmount = Math.round(order.totalPrice * refundRate * 100) / 100
        const deductionAmount = Math.round(order.totalPrice * deductionRate * 100) / 100

        // 订单状态校验：只有已支付(2)或已完成(4)可退款
        const statusRefundable = [2, 4].includes(order.status)

        return res.json(util.success("查询成功", {
            orderNumber: order.orderNumber,
            roomName: order.title,           // 统一字段名：原 order.roomName → order.title
            userName: order.userName,
            checkInDate: order.checkInDate,
            totalPrice: order.totalPrice,
            diffDays,
            canRefund: canRefund && statusRefundable,
            forceRefundable: statusRefundable, // 不可普通退款时，仍可强制退款
            refundRate,
            refundAmount,
            deductionRate,
            deductionAmount,
            rule
        }))
    } catch (error) {
        return res.json(util.fail("查询失败", error.message))
    }
}

/**
 * 酒店退款订单列表（复用 RefundOrder 表，orderType=3）
 */
exports.getHotelRefundList = async (req, res) => {
    try {
        const { pageNum = 1, pageSize = 10, orderNo, userPhone } = req.query

        let where = { orderType: 3 } // 酒店退款
        if (orderNo) where.orderNo = { [Op.like]: `%${orderNo}%` }
        if (userPhone) where.userPhone = { [Op.like]: `%${userPhone}%` }

        const { rows, count } = await RefundOrder.findAndCountAll({
            where,
            offset: (Number(pageNum) - 1) * Number(pageSize),
            limit: Number(pageSize),
            order: [['createdAt', 'DESC']]
        })

        return res.json(util.success("查询成功", {
            refundList: util.formDate(rows),
            total: count,
        }))
    } catch (error) {
        console.error("[Hotel Refund List] 获取酒店退款列表失败:", error)
        return res.json(util.fail("获取酒店退款列表失败", error.message))
    }
}

// 导出酒店订单列表EXCEL
exports.exportHotelOrderList = async (req, res) => {
    let { orderNumber, userPhone, userCard, status, startDate, endDate } = req.query

    try {
        let where = {}
        if (orderNumber) where.orderNumber = { [Op.like]: `%${orderNumber}%` }
        if (userPhone) where.userPhone = { [Op.like]: `%${userPhone}%` }
        if (userCard) where.userCard = { [Op.like]: `%${userCard}%` }
        if (status) where.status = status
        if (startDate || endDate) {
            where.createdAt = {
                [Op.between]: [startDate, endDate],
            };
        }

        let rows = await HotelOrder.findAll({
            where: where,
            order: [['id', 'DESC']]
        })

        // 格式化数据
        let excelData = rows.map(item => ({
            id: item.id,
            roomName: item.title,           // 统一字段名：原 item.roomName → item.title
            orderNumber: item.orderNumber,
            userName: item.userName,
            userPhone: item.userPhone,
            userCard: item.userCard,
            roomCount: item.roomCount,
            checkInDate: util.formDate(item.checkInDate),
            checkOutDate: util.formDate(item.checkOutDate),
            status: item.status,
            amount: item.orderAmount,       // 统一字段名：原 item.amount → item.orderAmount
            refundAmount: item.refundAmount,
        }))


        // 调用通用导出服务
        const { buffer, contentType, fileName } = await util.ExportService.exportData({
            fields: hotelOrderFields, // 导出字段
            title: '酒店订单详情',
            format: 'xlsx',
            data: excelData
        });

        console.log("数据是什么", buffer, contentType, fileName)


        // 返回文件
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(fileName));
        res.end(buffer);

    } catch (error) {
        return res.json(util.fail("获取失败", error.message))
    }
}


