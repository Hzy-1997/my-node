/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const { Op } = require('sequelize');
const util = require("../../../utils/util");

// 引入服务
const { sequelize } = require("../../../mysql/index");
const redisService = require("../../../services/redisService");

// 引入模型
const { Parking, ParkingSpot, ParkingReservation, Member } = require("../../../models/Summary")




// 创建停车场操作
exports.parkingOperation = async (req, res) => {
    try {
        const { action, id, title } = req.body;
        if (!action) return res.json(util.fail('缺少操作类型'));

        if (action == 'create') {
            if (!title) return res.json(util.fail('缺少停车场名称'));

            const existing = await Parking.findOne({
                where: { title: title }
            });
            if (existing) return res.json(util.fail('停车场已存在或名称重复'));

            await Parking.create(req.body);
            return res.json(util.success('创建成功'));

        } else if (action == 'update') {
            if (!id) return res.json(util.fail('缺少停车场ID'));

            const existing = await Parking.findByPk(id);
            if (!existing) return res.json(util.fail('停车场不存在'));

            // 如果更新title，检查是否重名
            if (title) {
                const duplicate = await Parking.findOne({
                    where: {
                        title: title,
                        id: { [Op.ne]: id }  // 排除当前记录
                    }
                });
                if (duplicate) return res.json(util.fail('停车场名称已存在'));
            }

            const [updated] = await Parking.update(req.body, {
                where: { id: id }
            });

            if (updated === 0) return res.json(util.fail('更新失败'));
            return res.json(util.success('更新成功'));

        } else if (action == 'delete') {
            if (!id) return res.json(util.fail('缺少停车场ID'));

            const existing = await Parking.findByPk(id);
            if (!existing) return res.json(util.fail('停车场不存在'));

            const deleted = await Parking.destroy({
                where: { id: id }
            });

            if (!deleted) return res.json(util.fail('删除失败'));
            return res.json(util.success('删除成功'));

        } else {
            return res.json(util.fail('不支持的操作类型'));
        }

    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

// 停车场列表
exports.parkingList = async (req, res) => {
    let { page = 1, pageSize = 10, title = '' } = req.query;
    page = parseInt(page);
    pageSize = parseInt(pageSize);
    try {
        let where = {};
        if (title) where.title = { [Op.like]: `%${title}%` }
        const { count, rows } = await Parking.findAndCountAll({
            where: where,
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['sortOrder', 'ASC']],
        }
        );
        return res.json(util.success('获取成功', { parkingList: util.formDate(rows), count }));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

// 单个停车场详情
exports.parkingDetail = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.json(util.fail('缺少停车场ID'));

        const parking = await Parking.findOne({
            where: { id: id },
            include: [{
                model: ParkingSpot,
                as: "spots",
            }]
        });
        if (!parking) return res.json(util.fail('停车场不存在'));

        return res.json(util.success('获取成功', parking));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}


//车位管理操作（创建/批量创建/更新/删除/列表）
exports.parkingSpotOperation = async (req, res) => {
    try {
        const { action, id, parkingId, spotNumber, area, spotType, status, sortOrder, prefix, start, count } = req.body;
        if (!action) return res.json(util.fail('缺少操作类型'));

        if (action == 'create') {
            if (!parkingId || !spotNumber) return res.json(util.fail('缺少停车场ID或车位编号'));

            const parking = await Parking.findByPk(parkingId);
            if (!parking) return res.json(util.fail('停车场不存在'));

            const existing = await ParkingSpot.findOne({
                where: { parkingId: parkingId, spotNumber: spotNumber }
            });
            if (existing) return res.json(util.fail('该停车场下车位编号已存在'));

            await ParkingSpot.create(req.body);
            return res.json(util.success('创建成功'));

        } else if (action == 'batchCreate') {
            // 批量创建：prefix + start + count，如 prefix=B1-A, start=1, count=50 → B1-A01 ~ B1-A50
            if (!parkingId || !prefix || !count) return res.json(util.fail('缺少停车场ID、编号前缀或数量'));

            const startNum = parseInt(start || 1);
            const totalCount = parseInt(count);
            if (isNaN(startNum) || startNum < 1 || isNaN(totalCount) || totalCount < 1 || totalCount > 500) {
                return res.json(util.fail('批量创建参数错误（起始编号>=1，数量1-500）'));
            }

            const parking = await Parking.findByPk(parkingId);
            if (!parking) return res.json(util.fail('停车场不存在'));

            // 生成编号，按最大编号位数补零对齐
            const width = String(startNum + totalCount - 1).length;
            const spots = [];
            for (let i = 0; i < totalCount; i++) {
                spots.push({
                    parkingId: parkingId,
                    spotNumber: `${prefix}${String(startNum + i).padStart(width, '0')}`,
                    area: area || null,
                    spotType: spotType || 1,
                    status: 1,
                    sortOrder: sortOrder || 0,
                });
            }

            // 检查同停车场下编号冲突
            const numbers = spots.map(s => s.spotNumber);
            const duplicates = await ParkingSpot.findAll({
                where: { parkingId: parkingId, spotNumber: { [Op.in]: numbers } },
                attributes: ['spotNumber'],
            });
            if (duplicates.length > 0) {
                return res.json(util.fail(`车位编号已存在：${duplicates.map(d => d.spotNumber).join('、')}`));
            }

            await ParkingSpot.bulkCreate(spots);
            return res.json(util.success(`批量创建成功，共${totalCount}个车位`));

        } else if (action == 'update') {
            if (!id) return res.json(util.fail('缺少车位ID'));

            const existing = await ParkingSpot.findByPk(id);
            if (!existing) return res.json(util.fail('车位不存在'));

            // 若修改编号，检查同停车场内是否重复
            if (spotNumber && spotNumber != existing.spotNumber) {
                const duplicate = await ParkingSpot.findOne({
                    where: {
                        parkingId: existing.parkingId,
                        spotNumber: spotNumber,
                        id: { [Op.ne]: id }
                    }
                });
                if (duplicate) return res.json(util.fail('该停车场下车位编号已存在'));
            }

            await ParkingSpot.update(req.body, { where: { id: id } });
            return res.json(util.success('更新成功'));

        } else if (action == 'delete') {
            if (!id) return res.json(util.fail('缺少车位ID'));

            const existing = await ParkingSpot.findByPk(id);
            if (!existing) return res.json(util.fail('车位不存在'));

            // 校验是否存在关联预约记录（含历史），避免预约数据失去车位关联
            const reservationCount = await ParkingReservation.count({ where: { spotId: id } });
            if (reservationCount > 0) {
                return res.json(util.fail(`该车位存在${reservationCount}条预约记录，无法删除，建议将其停用`));
            }

            await ParkingSpot.destroy({ where: { id: id } });
            return res.json(util.success('删除成功'));

        } else if (action == 'list') {
            let { page = 1, pageSize = 10 } = req.body;
            page = parseInt(page);
            pageSize = parseInt(pageSize);

            const where = {};
            if (parkingId) where.parkingId = parkingId;
            if (status) where.status = status;

            const { count, rows } = await ParkingSpot.findAndCountAll({
                where,
                offset: (page - 1) * pageSize,
                limit: pageSize,
                order: [['sortOrder', 'ASC'], ['id', 'ASC']],
            });
            return res.json(util.success('获取成功', { spotList: util.formDate(rows), count }));

        } else {
            return res.json(util.fail('不支持的操作类型'));
        }

    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

/**
 *  查询停车场车位列表（含指定时段的可用状态）
 * 预约时长固定为1小时（最短最长均为1小时），时段必传；
 * 可用性判断（时段重叠）：车位 [start, end) 可用 = 不存在
 * 未取消/未作废预约单（status 不为 2/4）与其时间区间有交集；
 * 已支付但时段结束未使用的订单由定时任务自动作废（status=4，订单终结不可再用）
 */
exports.parkingSpots = async (req, res) => {
    try {
        const { parkingId, startTime, endTime, status } = req.query;
        if (!parkingId) return res.json(util.fail('缺少停车场ID'));
        if (!startTime || !endTime) return res.json(util.fail('缺少预约时间段'));

        const where = { parkingId: parkingId };
        if (status) where.status = parseInt(status);

        const spots = await ParkingSpot.findAll({
            where,
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
        });

        // 时段必传，预约时长固定为1小时（最短最长均为1小时）
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
            return res.json(util.fail('时间参数错误'));
        }
        if (end - start !== 60 * 60 * 1000) {
            return res.json(util.fail('预约时长必须为1小时'));
        }

        // 查询该时段内被占用的车位（非已退款/已取消的预约即占位：
        // 待支付1占位防超卖、已完成3=已支付订单在其时段内占位；
        // 时段已过的历史订单不会与新预约发生时间重叠）
        const overlaps = await ParkingReservation.findAll({
            where: {
                parkingId: parkingId,
                payStatus: { [Op.notIn]: [4, 5] },
                startTime: { [Op.lt]: end },
                endTime: { [Op.gt]: start },
            },
            attributes: ['spotId'],
        });
        const occupiedSpotIds = new Set(overlaps.map(item => item.spotId));

        const spotList = spots.map(spot => ({
            ...spot.toJSON(),
            available: spot.status == 1 && !occupiedSpotIds.has(spot.id),
        }));

        return res.json(util.success('获取成功', {
            spotList,
            availableCount: spotList.filter(s => s.available).length,
        }));
    } catch (error) {
        return res.json(util.fail(error.message));
    }
}




/**
 * @description: 停车场预约（按具体车位 + 时段重叠判断可用性）
 * @param {*} req 
 * @param {*} res 
 * @returns {Promise<void>}
 * @param {number} parkingId - 停车场ID
 * @param {number} spotId - 车位ID（用户选择的具体车位）
 * @param {number} userId - 用户ID
 * @param {string} phone - 手机号
 * @param {string} idCard - 身份证号
 * @param {string} carNumber - 车牌号
 * @param {string} startTime - 开始时间
 * @param {string} endTime - 结束时间（与开始时间相差整1小时）
 * 
 * 车位可用性判断：所选时段 [start, end) 内不存在
 * 该车位的非已退款/非已取消预约单（payStatus 不为 4/5 且时间区间有交集）
 * 预约时长固定为1小时（最短最长均为1小时）；
 * 已支付订单支付成功即为 3已完成（下单即核销），时段结束后自然释放时段
 * 不再扣减 Parking.availableCount（该字段仅作展示）
 */

// 停车场预约
exports.parkingAppointment = async (req, res) => {
    try {
        const { parkingId, spotId, userId, phone, idCard, carNumber, startTime, endTime } = req.body;

        if (!parkingId || !spotId || !userId || !phone || !idCard || !carNumber || !startTime || !endTime) return res.json(util.fail("缺少必填信息"));


        let user = await Member.findByPk(userId);
        if (!user) return res.json(util.fail('用户不存在'));

        let existing = await Parking.findOne({
            where: {
                id: parkingId
            }
        })
        if (!existing) return res.json(util.fail('停车场不存在'));

        // 快速预检车位归属（权威校验在事务内进行）
        const preSpot = await ParkingSpot.findOne({ where: { id: spotId, parkingId: parkingId } });
        if (!preSpot) return res.json(util.fail('车位不存在'));
        if (preSpot.status != 1) return res.json(util.fail('该车位已停用维护'));


        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.json(util.fail("时间格式错误"));
        }
        if (start >= end) {
            return res.json(util.fail("开始时间必须早于结束时间"));
        }
        if (start < new Date()) {
            return res.json(util.fail("开始时间不能早于当前时间"));
        }
        // 预约时长固定为1小时（最短最长均为1小时）
        if (end - start !== 60 * 60 * 1000) {
            return res.json(util.fail("预约时长必须为1小时"));
        }



        // 分布式锁，防止同一停车场并发预约导致车位时段被重复占用
        const lockName = `parking:lock:${parkingId}`;
        const lockValue = await redisService.acquireLockWithRetry(lockName, 10, 1000);
        if (!lockValue) return res.json(util.fail("当前预约人数过多，请稍后再试"));

        // 开启一个 Sequelize 数据库事务，确保"车位时段校验 + 写入预约记录"操作的数据一致性
        const t = await sequelize.transaction();

        try {
            // 事务内二次校验车位状态，确保读取的数据是最新且一致的
            const parking = await Parking.findByPk(parkingId, { transaction: t });
            if (!parking) {
                await t.rollback();
                return res.json(util.fail("停车场不存在"));
            }

            const spot = await ParkingSpot.findByPk(spotId, { transaction: t });
            if (!spot || spot.parkingId != parkingId) {
                await t.rollback();
                return res.json(util.fail("车位不存在"));
            }
            if (spot.status != 1) {
                await t.rollback();
                return res.json(util.fail("该车位已停用维护"));
            }

            // 时段重叠检查：该车位的非已退款/非已取消预约与 [start, end) 有交集则不可预约
            const overlap = await ParkingReservation.findOne({
                where: {
                    spotId: spotId,
                    payStatus: { [Op.notIn]: [4, 5] },
                    startTime: { [Op.lt]: end },
                    endTime: { [Op.gt]: start },
                },
                transaction: t,
            });
            if (overlap) {
                await t.rollback();
                return res.json(util.fail("该车位在所选时段已被预约，请更换车位或时间"));
            }

            // 生成订单号
            let orderNo = await util.generateOrderNo("ORDPK");
            // const writeOffCode = await util.generateWriteOffCode();

            const reservation = await ParkingReservation.create(
                {
                    orderNumber: orderNo,
                    title: parking.title,
                    parkingId,
                    spotId,
                    spotNumber: spot.spotNumber,
                    userId,
                    phone,
                    idCard,
                    carNumber,
                    startTime: start,
                    endTime: end,
                    orderAmount: parking.price,
                    writeOffCode: orderNo,
                    payStatus: 1, // 待支付（统一五态，原 status 预约状态字段已删除）
                },
                { transaction: t },
            );

            await t.commit(); // 提交事务，确保数据一致性

            // 支付超时标记（10分钟，超时未支付由定时任务自动取消并释放车位时段）
            await redisService.setFun(`parking:pay:expire:${orderNo}`, 1, 10 * 60);

            return res.json(
                util.success("预约单已创建，请尽快支付", {
                    orderNo,
                    writeOffCode,
                    spotNumber: spot.spotNumber,
                    reservationId: reservation.id,
                    price: parking.price,
                    startTime: util.formatTime(start),
                    endTime: util.formatTime(end),
                    payStatus: 1,
                    expireSeconds: 600,
                }),
            );
        } catch (error) {
            if (t && !t.finished) await t.rollback();
            return res.json(util.fail(error.message));
        } finally {
            await redisService.releaseLock(lockName, lockValue);
        }

    } catch (error) {
        return res.json(util.fail(error.message));
    }
}

// 