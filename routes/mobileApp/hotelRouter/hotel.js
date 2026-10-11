const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { generateNights } = require("../../../utils/dateHelper");
const { Hotel, RoomType, RoomPackage, RoomDatePrice, RoomInventory } = require("../../../models/Summary");
const { sequelize } = require("../../../mysql/index");
const redisService = require('../../../services/redisService');



// 获取列表
exports.hotelList = async (req, res) => {
    try {

        const hotelKey = `hotel:list`; // Redis 键名
        const hotelList = await redisService.getFun(hotelKey);
        if (hotelList) {
            return res.json(util.success("获取成功", hotelList))
        }


        let data = await Hotel.findAll()
        // 为每个酒店查询最低价格
        const hotelsWithMinPrice = await Promise.all(
            data.map(async (hotel) => {
                // 查询该酒店的所有房型 查询这些房型的所有套餐
                const roomTypes = await RoomType.findAll({
                    where: { hotelId: hotel.id }
                });

                // return res.json(util.success("获取成功", roomTypes))

                const roomTypeIds = roomTypes.map(rt => rt.id);
                const roomPackages = await RoomPackage.findAll({
                    where: {
                        roomTypeId: roomTypeIds,
                        status: 1,
                        // 过滤未过期的套餐：结束日期 >= 当前日期
                        endDate: { [Op.gte]: Sequelize.fn('CURDATE') }
                    }
                });

                // 查询这些套餐的所有有效价格
                const roomPackageIds = roomPackages.map(rp => rp.id);
                const minPriceResult = await RoomDatePrice.findOne({
                    attributes: [[Sequelize.fn('MIN', Sequelize.col('price')), 'minPrice']],
                    where: {
                        roomPackageId: roomPackageIds,
                        status: 1,
                        date: {
                            [Op.gte]: Sequelize.fn('CURDATE')
                        }
                    },
                    raw: true
                });

                console.log("酒店最低价格", minPriceResult)

                // 将最低价格添加到酒店数据中
                const hotelData = hotel.toJSON ? hotel.toJSON() : hotel;
                hotelData.minPrice = minPriceResult?.minPrice || null;

                return hotelData;
            })
        );
        // 写入 Redis 缓存 30分钟
        await redisService.setFun(hotelKey, hotelsWithMinPrice, 1800);

        return res.json(util.success("获取成功", hotelsWithMinPrice))
    } catch (error) {
        console.error("获取酒店列表错误:", error);
        return res.json(util.fail(error.message))
    }
}

// 酒店房型列表
exports.hotelInformation = async (req, res) => {
    try {
        // 1. 参数校验
        const { id, checkIn, checkOut } = validateParams(req.query);

        // 2. 尝试从缓存获取数据
        const cacheKey = `hotel:info:${id}:${checkIn || 'null'}:${checkOut || 'null'}`;
        const cachedData = await redisService.getFun(cacheKey);
        if (cachedData) {
            return res.json(util.success("获取成功", cachedData));
        }
        // 3. 并行查询基础数据
        const [hotel, dailyMinPrices, roomTypes] = await Promise.all([
            Hotel.findOne({
                where: { id },
                attributes: { exclude: ['created_at', 'updated_at'] }
            }),
            RoomDatePrice.findAll({
                attributes: [
                    'date',
                    [Sequelize.fn('MIN', Sequelize.col('room_date_price.price')), 'minPrice'],
                    [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('package.id'))), 'packageCount']
                ],
                include: [{
                    model: RoomPackage,
                    as: 'package',
                    attributes: [],
                    include: [{
                        model: RoomType,
                        as: 'roomType',
                        attributes: [],
                        where: { hotelId: id }
                    }],
                    where: { status: 1 }
                }],
                where: {
                    status: 1,
                    date: {
                        [Op.gte]: Sequelize.fn('CURDATE'),
                        [Op.lt]: Sequelize.literal('DATE_ADD(CURDATE(), INTERVAL 90 DAY)')
                    }
                },
                group: ['date'],
                order: [['date', 'ASC']],
                raw: true
            }),
            RoomType.findAll({
                where: { hotelId: id, status: 1 },
                attributes: { exclude: ['created_at', 'updated_at'] }
            })
        ]);

        if (!hotel) {
            return res.json(util.fail("酒店不存在"));
        }

        // 4. 批量查询关联数据
        console.log("房型1", roomTypes)
        const roomTypeIds = roomTypes.map(rt => rt.id);
        console.log("房型2", roomTypeIds)


        const allRoomPackages = await RoomPackage.findAll({
            where: {
                roomTypeId: { [Op.in]: roomTypeIds },
                status: 1,
                // 过滤未过期的套餐：结束日期 >= 当前日期
                endDate: { [Op.gte]: Sequelize.fn('CURDATE') }
            },
            attributes: { exclude: ['created_at', 'updated_at'] }
        });

        // 按房型分组套餐
        const packagesByRoomType = {};
        console.log("所有套餐", allRoomPackages)
        allRoomPackages.forEach(pkg => {
            if (!packagesByRoomType[pkg.roomTypeId]) {
                packagesByRoomType[pkg.roomTypeId] = [];
            }
            packagesByRoomType[pkg.roomTypeId].push(pkg);
        });
        console.log("套餐查看", packagesByRoomType)

        // 5. 批量查询价格数据
        const allPackageIds = allRoomPackages.map(pkg => pkg.id);
        const [allPrices, allRangePrices] = await Promise.all([
            // 查询所有套餐的未来价格
            RoomDatePrice.findAll({
                where: {
                    roomPackageId: { [Op.in]: allPackageIds },
                    status: 1,
                    date: { [Op.gte]: Sequelize.fn('CURDATE') }
                },
                attributes: ['id', 'roomPackageId', 'date', 'price', 'stock', 'availableStock', 'soldStock'],
                order: [['roomPackageId', 'ASC'], ['date', 'ASC']]
            }),
            // 查询日期范围内的价格（如果有日期范围）
            checkIn && checkOut ? RoomDatePrice.findAll({
                where: {
                    roomPackageId: { [Op.in]: allPackageIds },
                    status: 1,
                    date: {
                        [Op.gte]: checkIn,
                        [Op.lt]: checkOut
                    }
                },
                attributes: ['roomPackageId', 'date', 'price', 'stock', 'availableStock', 'soldStock'],
                raw: true
            }) : Promise.resolve([])
        ]);

        // 按套餐分组价格
        const pricesByPackage = {};
        allPrices.forEach(price => {
            if (!pricesByPackage[price.roomPackageId]) {
                pricesByPackage[price.roomPackageId] = [];
            }
            pricesByPackage[price.roomPackageId].push(price);
        });

        // 按套餐分组日期范围价格
        const rangePricesByPackage = {};
        allRangePrices.forEach(price => {
            if (!rangePricesByPackage[price.roomPackageId]) {
                rangePricesByPackage[price.roomPackageId] = [];
            }
            rangePricesByPackage[price.roomPackageId].push(price);
        });

        // 6. 处理房型数据
        const roomTypesWithPackages = await Promise.all(roomTypes.map(async (roomType) => {

            const roomTypeData = roomType.toJSON ? roomType.toJSON() : roomType;
            console.log("房型", roomType)
            const roomPackages = packagesByRoomType[roomType.id] || [];

            console.log("配置套餐", roomPackages)

            // 处理每个套餐
            const packagesWithPrices = roomPackages.map(roomPackage => {
                const packageData = roomPackage.toJSON ? roomPackage.toJSON() : roomPackage;

                // 设置价格数据
                packageData.prices = pricesByPackage[roomPackage.id] || [];

                // 处理日期范围
                if (checkIn && checkOut) {
                    const rangePrices = rangePricesByPackage[roomPackage.id] || [];

                    // 计算总价格
                    const totalPrice = rangePrices.reduce((sum, record) => {
                        return sum + parseFloat(record.price || 0);
                    }, 0);
                    packageData.totalPrice = totalPrice;

                    // 构建每日库存和价格详情
                    const dailyStock = [];
                    const dateRange = generateNights(checkIn, checkOut);

                    dateRange.forEach(dateStr => {
                        const dayPrice = rangePrices.find(p => {
                            // 统一日期格式为 YYYY-MM-DD 进行比较
                            const pDate = p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date;
                            return pDate === dateStr;
                        });
                        if (dayPrice) {
                            dailyStock.push({
                                date: dateStr,
                                price: parseFloat(dayPrice.price || 0),
                                stock: dayPrice.stock || 0,
                                soldStock: dayPrice.soldStock || 0,
                                availableStock: dayPrice.availableStock || 0
                            });
                        }
                    });
                    packageData.dailyStock = dailyStock;
                } else {
                    // 没有日期范围时，查询当日价格
                    const todayPrice = pricesByPackage[roomPackage.id]?.find(p => {
                        const priceDate = new Date(p.date);
                        const today = new Date();
                        return priceDate.toDateString() === today.toDateString();
                    });
                    packageData.todayPrice = todayPrice ? todayPrice.price : null;
                }

                return packageData;
            });

            roomTypeData.packages = packagesWithPrices;

            // 计算房型最低价格
            if (checkIn && checkOut) {
                const allTotalPrices = packagesWithPrices
                    .map(pkg => pkg.totalPrice)
                    .filter(price => price !== undefined && price !== null);
                roomTypeData.minPrice = allTotalPrices.length > 0 ? Math.min(...allTotalPrices) : null;
            } else {
                const allPrices = packagesWithPrices.flatMap(pkg =>
                    pkg.prices.map(price => parseFloat(price.price))
                );
                roomTypeData.minPrice = allPrices.length > 0 ? Math.min(...allPrices) : null;
            }

            // 房型级别库存判断（从 RoomInventory 读取房型共享库存）
            let isBuyable = true;
            if (checkIn && checkOut) {
                const dateRange = generateNights(checkIn, checkOut);

                // 一次性查询该房型在日期范围内的所有库存记录
                const inventories = await RoomInventory.findAll({
                    where: {
                        roomTypeId: roomTypeData.id,
                        date: { [Op.in]: dateRange }
                    },
                    attributes: ['date', 'availableStock']
                });
                const invMap = {};
                inventories.forEach(inv => { invMap[inv.date] = inv.availableStock; });

                // 检查每一天的库存
                for (const dateStr of dateRange) {
                    const availableStock = invMap[dateStr];
                    // 无记录或可售 <= 0，则不可售
                    if (availableStock === undefined || availableStock <= 0) {
                        isBuyable = false;
                        break;
                    }
                }
            }

            roomTypeData.isBuyable = isBuyable;
            return roomTypeData;
        }));

        // 7. 构建返回数据
        const result = {
            hotel: hotel.toJSON ? hotel.toJSON() : hotel,
            roomTypes: roomTypesWithPackages,
            dailyMinPrices: dailyMinPrices,
            serverTime: new Date().toISOString()
        };

        // 如果有查询日期范围，也返回给前端
        if (checkIn && checkOut) {
            result.checkIn = checkIn;
            result.checkOut = checkOut;
        }

        // 8. 缓存结果（10分钟）
        await redisService.setFun(cacheKey, result, 600);

        return res.json(util.success("获取成功", result));

    } catch (error) {
        console.error("获取酒店详情错误:", error);
        return res.json(util.fail(error.message));
    }
};

// 工具函数：参数校验、日期计算、缓存、返回数据格式化
function validateParams(params) {
    const { id, checkIn, checkOut, num } = params;

    if (!id) {
        throw new Error("酒店ID不能为空");
    }

    if (num && num < 1 || num > 5) {
        throw new Error("购买数量不错误");
    }

    if (!checkIn || !checkOut) {
        throw new Error("入住/离店时间不能为空");
    }

    if (checkIn && checkOut) {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
            throw new Error("入住/离店时间格式不正确");
        }

        if (checkInDate >= checkOutDate) {
            throw new Error("离店时间必须晚于入住时间");
        }
    }

    return { id, checkIn, checkOut, num };
}

// 获取单个详细
exports.getHotelDetail = async (req, res) => {
    try {
        const { id } = req.query;
        const result = await Hotel.findByPk(id);
        return res.json(util.success("获取成功", result));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}


// 付款
exports.buyHotel = async (req, res) => {
    try {
        const { id, checkIn, checkOut, num } = validateParams(req.body);
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

