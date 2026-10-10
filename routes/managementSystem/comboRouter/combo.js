// 工具
const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");
const { calculateDatePrices } = require("../ADateConfiguration/index");
const redisService = require("../../../services/redisService");
const comboPurchaseService = require("../../../services/comboPurchaseService");
const queueService = require("../../../services/queueService");
const { compareAsc, format } = require("date-fns");
const { generateNights } = require("../../../utils/dateHelper");

// 首先引入所有模型
const {
  ProductPackage,
  PackageItem,
  PackagePriceRule,
  PackageDatePrice,
  RoomType,
  RoomDatePrice,
  RoomInventory,
  Member,
  RoomPackage,
  Hotel,
  Ticket,
  TicketPriceRule,
} = require("../../../models/Summary");

// 查询数据是否存在
async function queryData(id, model) {
  if (!id) return false;
  let state = await model.findOne({ where: { id } });
  return state !== null;
}

// 套餐操作
exports.comboOperation = async (req, res) => {
  let { action } = req.body;
  if (!action) return res.json(util.fail("无效的操作,缺少必要参数"));

  try {
    if (action === "create") {
      await ProductPackage.create(req.body);
      return res.json(util.success("创建成功"));
    } else if (action === "update") {
      let { id } = req.body;
      const exists = await queryData(id, ProductPackage);
      console.log("返回的是什么", exists);
      if (!exists) return res.json(util.fail("无效的操作或套餐不存在"));

      await ProductPackage.update(req.body, { where: { id } });
      return res.json(util.success("更新成功"));
    } else if (action === "delete") {
      let { id } = req.body;
      const exists = await queryData(id, ProductPackage);
      if (!exists) return res.json(util.fail("无效的操作或套餐不存在"));

      await ProductPackage.destroy({ where: { id }, individualHooks: true });
      return res.json(util.success("删除成功"));
    } else {
      return res.json(util.fail("无效的操作类型"));
    }
  } catch (err) {
    return res.json(util.fail("操作失败", err.message));
  }
};

// 套餐列表
exports.comboList = async (req, res) => {
  try {
    let { pageNum = 1, pageSize = 10, type, name, status, id } = req.query;

    pageNum = parseInt(pageNum);
    pageSize = parseInt(pageSize);
    let where = {};
    if (type) where.type = type;
    if (name) where.name = { [Op.like]: `%${name}%` };
    if (id) where.id = id;
    if (status) where.status = status;

    let includes = [];
    // 传入套餐ID时带出子项（含子项的酒店房型/门票关联）
    if (id) {
      includes.push({
        model: PackageItem,
        as: 'items',
        include: [
          {
            model: RoomPackage,
            as: 'roomPackage',
            attributes: ['id', 'name'],
            include: [
              {
                model: RoomType,
                as: 'roomType',
                // attributes: ['id', 'name'],
                include: [{ model: Hotel, as: 'hotel' }],
              },
            ],
          },
          {
            model: Ticket,
            as: 'ticket',
          },
        ],
      });
    }

    const { count, rows } = await ProductPackage.findAndCountAll({
      where,
      include: includes,
      offset: (pageNum - 1) * pageSize,
      limit: pageSize,
      // order: [["sortOrder", "DESC"]],
    });

    let list = util.formDate(rows);

    return res.json(
      util.success("获取成功", {
        list: list,
        total: count,
        currentPage: parseInt(pageNum),
        totalPages: Math.ceil(count / parseInt(pageSize)),
      })
    );
  } catch (err) {
    return res.json(util.fail("操作失败", err.message));
  }
};

// 获取套餐产品列表
exports.getPackageProductList = async (req, res) => {
  try {
    let { pageNum = 1, pageSize = 10, type = 1, } = req.query;
    pageNum = parseInt(pageNum);
    pageSize = parseInt(pageSize);

    let includes = [{
      model: PackageItem,
      as: 'items',
      include: [
        {
          model: RoomPackage,
          as: 'roomPackage',
          attributes: ['id', 'name'],
          include: [
            {
              model: RoomType,
              as: 'roomType',
              attributes: ['id', 'name'],
              include: [{ model: Hotel, as: 'hotel' }],
            },
          ],
        },
        {
          model: Ticket,
          as: 'ticket',
        },
      ],
    }]

    const allData = await ProductPackage.findAll({
      include: includes,
      where: { type },
      order: [["sortOrder", "ASC"]],
    });

    // 转换为普通对象（解决循环引用）
    const plainAllData = allData.map(item =>
      item.toJSON ? item.toJSON() : item
    );

    // 找出所有数据中的最低价
    let lowestItem = findLowestPriceItem(plainAllData);


    const { count, rows } = await ProductPackage.findAndCountAll({
      include: includes,
      where: { type },
      offset: (pageNum - 1) * pageSize,
      limit: pageSize,
      order: [["sortOrder", "ASC"]],
    });

    let list = processPackageLowestPrice(util.formDate(rows));
    // let list = util.formDate(rows);

    let data = {
      list: list,
      info: lowestItem,
      total: count,
      currentPage: parseInt(pageNum),
      totalPages: Math.ceil(count / parseInt(pageSize)),
    }



    return res.json(
      util.success("获取成功", data)
    );
  } catch (err) {
    console.log(err);
    return res.json(util.fail("操作失败", err.message));
  }
}

function processPackageLowestPrice(packageList) {
  return packageList.map(pkg => {
    // 复制对象，避免修改原数据
    const newPkg = { ...pkg };

    // 如果 items 不存在或为空，直接返回
    if (!newPkg.items || newPkg.items.length === 0) {
      newPkg.lowestOriginalPrice = null;
      newPkg.lowestUnitPrice = null;
      return newPkg;
    }

    // 找出 originalPrice 最低的 item
    let lowestItem = newPkg.items.reduce((min, current) => {
      const minPrice = parseFloat(min.originalPrice) || Infinity;
      const currentPrice = parseFloat(current.originalPrice) || Infinity;
      return currentPrice < minPrice ? current : min;
    }, newPkg.items[0]);

    // 将最低价提取到父对象
    newPkg.lowestOriginalPrice = lowestItem.originalPrice;
    newPkg.lowestUnitPrice = lowestItem.unitPrice;
    // 可选：同时保存最低价对应的 itemId 方便追溯
    newPkg.lowestPriceItemId = lowestItem.id;

    return newPkg;
  });
};


// 获取最低套餐
function findLowestPriceItem(packages) {
  let lowestItem = null;
  let lowestPrice = Infinity;

  // 遍历所有套餐
  for (const pkg of packages) {
    if (pkg.items && Array.isArray(pkg.items)) {
      for (const item of pkg.items) {
        const price = parseFloat(item.unitPrice);
        if (!isNaN(price) && price < lowestPrice) {
          lowestPrice = price;
          lowestItem = {
            ...item,
            packageName: pkg.name,      // 附带套餐名
            packageId: pkg.id            // 附带套餐ID
          };
        }
      }
    }
  }

  return lowestItem;
};


// 套餐产品操作
exports.productOperation = async (req, res) => {
  let { id, action, packageId } = req.body;
  if (!action) return res.json(util.fail("无效的操作,缺少必要参数"));
  try {
    if (action == "create") {
      if (!packageId) return res.json(util.fail("缺少必要参数"));

      const exists = await queryData(packageId, ProductPackage);
      if (!exists) return res.json(util.fail("无效的操作或套餐不存在"));

      req.body.sortOrder = parseInt(req.body.sortOrder);
      req.body.useDateOffset = parseInt(req.body.useDateOffset);
      req.body.groupId = parseInt(req.body.groupId);
      req.body.maxSaleNum = parseInt(req.body.maxSaleNum);
      req.body.maxBuyNum = parseInt(req.body.maxBuyNum);
      req.body.quantity = parseInt(req.body.quantity);
      req.body.useDateOffset = parseFloat(req.body.useDateOffset);
      req.body.unitPrice = parseFloat(req.body.unitPrice);

      await PackageItem.create(req.body);
      return res.json(util.success("创建成功"));
    } else if (action == "update") {
      const exists = await queryData(id, PackageItem);
      if (!exists) return res.json(util.fail("无效的操作或套餐不存在"));
      await PackageItem.update(req.body, { where: { id } });
      return res.json(util.success("更新成功"));
    } else if (action === "delete") {
      const exists = await queryData(id, PackageItem);
      if (!exists) return res.json(util.fail("无效的操作或套餐不存在"));
      await PackageItem.destroy({ where: { id } });
      return res.json(util.success("删除成功"));
    }
  } catch (error) {
    return res.json(util.fail("系统错误", error.message));
  }
};

// 获取产品列表
exports.getProductList = async (req, res) => {
  try {
    let { page = 1, pageSize = 10, itemName, itemType, id } = req.query;

    let where = {};
    if (itemName) where.itemName = { [Op.like]: `%${itemName}%` };
    if (itemType) where.itemType = itemType;
    // 两种关联都加入，Sequelize 会根据每条记录的外键自动 JOIN
    // 外键为 null 的关联自然返回 null，不会报错
    let includes = [
      {
        model: RoomPackage,
        as: "roomPackage",
        attributes: ["id", "name"],
        include: [
          {
            model: RoomType,
            as: "roomType",
            attributes: ["id", "name"],
            include: [
              {
                model: Hotel,
                as: "hotel",
              },
            ],
          },
        ],
      },
      {
        model: Ticket,
        as: "ticket",
        // attributes: ["id"],
      },
    ];

    let data = await PackageItem.findAndCountAll({
      where: where,
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize),
      include: includes,
      order: [["id", "DESC"]],
    });
    let list = util.formDate(data.rows);
    return res.json(
      util.success("获取成功", {
        list: list,
        total: data.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(data.count / parseInt(pageSize)),
      })
    );
  } catch (error) {
    return res.json(util.fail("系统错误", error.message));
  }
};


// 创建套餐日期价格规则
exports.createTicketPriceRule = async (req, res) => {
  try {
    let { packageItemId, action, ruleConfig } = req.body;
    if (!action) return res.json(util.fail("缺少操作类型"));
    if (!packageItemId) return res.json(util.fail("请选择套餐"));
    if (!ruleConfig) return res.json(util.fail("请输入日期价格规则"));
    if (action == "create") {
      let comboState = await PackageItem.findOne({ where: { id: packageItemId } });
      if (!comboState) return res.json(util.fail("套餐不存在"));
      if (comboState.state == 2) return res.json(util.fail("套餐已下架"));
      let packageRule = await PackagePriceRule.findOne({
        where: { packageItemId: comboState.id },
      }); // 判断是否已经存在

      let Rule = {};
      // 如果存在则更新，否则创建
      if (packageRule) {
        Rule = await PackagePriceRule.update(req.body, { where: { id: packageRule.id } }); // 更新
      } else {
        Rule = await PackagePriceRule.create(req.body);
      }
      // 通过 roomPackageId 先查 RoomPackage 拿到 roomTypeId，再查 RoomType
      const roomPackageInfo = await RoomPackage.findOne({
        where: { id: comboState.roomPackageId },
      });
      if (!roomPackageInfo) return res.json(util.fail("酒店套餐不存在"));
      let room = await RoomType.findOne({ where: { id: roomPackageInfo.roomTypeId } });
      console.log("房型", room);
      if (!room) return res.json(util.fail("房间类型不存在"));

      let combo = await PackageItem.findOne({
        where: { id: packageItemId },
        include: [
          {
            model: PackagePriceRule,
            as: "priceRule",
            attributes: ["id", "ruleConfig"],
          },
        ],
      });

      if (combo.maxSaleNum > room.stock)
        return res.json(util.fail("最大销售数量不能大于库存数量"));

      let priceData = {
        id: combo.id, // 套餐id
        startDate: combo.startDate, // 开始时间
        endDate: combo.endDate, // 结束时间
        price: combo.unitPrice, // 价格
        stock: combo.maxSaleNum, // 库存
        // 将单个对象转换为数组
        priceRules: combo.priceRule
          ? [
            {
              startDate: combo.startDate, // 开始时间
              endDate: combo.endDate, // 结束时间
              id: combo.priceRule.id, // 规则id
              ruleConfig: combo.priceRule.ruleConfig, // 规则配置
            },
          ]
          : [],
      };
      console.log("日期是多少", priceData.startDate, priceData.endDate);

      let DatePriceList = await calculateDatePrices(priceData, priceData.priceRules);

      let datePrice = DatePriceList.map((item) => ({
        packageItemId: item.id,
        date: item.date,
        price: item.price,
        priceType: 1, // 规则价格
        stock: item.stock || 0,
        sold_stock: 0,
        availableStock: item.availableStock || item.stock || 0,
        status: 1,
      }));

      const result = await PackageDatePrice.bulkCreate(datePrice, {
        updateOnDuplicate: [
          "price",
          "price_type",
          "stock",
          "sold_stock",
          "available_stock",
          "status",
          "updated_at",
        ],
      });

      if (!result) return res.json(util.fail("操作失败,联系管理员"));

      return res.json(
        util.success("创建成功", { Rule, room, combo, priceData, DatePriceList })
      );

      /// 更新套餐日期价格规则
    } else if (action == "update") {
      let rule = await PackagePriceRule.findOne({ where: { id: ruleConfig.id } });
      if (!rule) return res.json(util.fail("规则不存在"));
      await PackagePriceRule.update(req.body);
      return res.json(util.success("更新成功"));
    }
  } catch (error) {
    return res.json(util.fail("系统错误", error.message));
  }
};

// 购买套餐
exports.buyCombo = async (req, res) => {
  try {
    const { id, userId, packageItemId, itemType, num, startDate, endDate } = req.body;

    if (!userId || !packageItemId || !itemType || !num || !startDate || !endDate) {
      return res.json(util.fail("缺少必要信息"));
    }
    if (itemType != 1 && itemType != 2) return res.json(util.fail("类型错误"));
    if (num > 5) return res.json(util.fail("最大购买数量不能超过5个"));

    const combo = await PackageItem.findOne({
      where: { id: packageItemId },
      include: [
        {
          model: RoomPackage,
          as: "roomPackage",
        },
      ],
    });

    // return res.json(util.fail("套餐不存在", combo))
    if (!combo) return res.json(util.fail("套餐不存在"));
    // if (combo.status != 1) return res.json(util.fail("套餐不可用",{ combo }))
    console.log(
      "日期",
      combo,
      format(combo.roomPackage.endDate, "yyyy-MM-dd"),
      format(new Date(), "yyyy-MM-dd")
    );

    if (combo.endDate < format(new Date(), "yyyy-MM-dd"))
      return res.json(util.fail("套餐已过期"));
    if (
      format(combo.roomPackage.endDate, "yyyy-MM-dd") < format(new Date(), "yyyy-MM-dd")
    )
      return res.json(util.fail("房型已过期"));

    if (combo.maxSaleNum < num) return res.json(util.fail("暂无库存"));

    if (endDate < format(new Date(), "yyyy-MM-dd"))
      return res.json(util.fail("时间错误"));

    const user = await Member.findOne({ where: { id: userId } });
    if (!user) return res.json(util.fail("用户不存在"));

    // 生成订单号
    let orderNo = await util.generateOrderNo("ORDPK");

    // 酒店
    if (itemType == 1) {
      const roomPackage = combo.roomPackage;

      if (!roomPackage) return res.json(util.fail("套餐未关联酒店房型"));

      // 查询房间类型
      const roomType = await RoomType.findOne({ where: { id: roomPackage.roomTypeId } });
      if (!roomType) return res.json(util.fail("房间类型不存在"));
      if (roomType.status != 1) return res.json(util.fail("房间类型不可用"));

      const fullDateRange = generateNights(combo.startDate, combo.endDate); // 套餐有效日期范围
      const dateRange = generateNights(startDate, endDate); // 购买日期范围

      console.log("库存预热日期", fullDateRange);
      console.log("购买日期", dateRange);

      // ========== 检查并初始化Redis库存 ==========
      await initializeStockIfNeeded(combo, roomPackage, roomType, fullDateRange);

      // ==========  扣减库存（Redis + Lua）==========
      let purchaseResult;

      // 对于酒店套餐，需要检查每一天的库存
      for (const date of dateRange) {
        purchaseResult = await comboPurchaseService.purchaseCombo({
          packageItemId: combo.id,
          roomTypeId: roomType.id,
          quantity: num,
          userId: userId,
          orderNo: orderNo,
          date: date,
        });

        if (!purchaseResult.success) {
          // 如果某一天库存不足，需要回滚已扣减的库存
          await rollbackStock(
            dateRange.slice(0, dateRange.indexOf(date)),
            combo.id,
            roomType.id,
            num
          );
          return res.json(
            util.fail(purchaseResult.message, { code: purchaseResult.code })
          );
        }
      }

      // ========== 构建订单数据 ==========
      const orderData = {
        orderNumber: orderNo,
        packageItemId: combo.id,
        productPackageId: combo.packageId,
        userId: userId,
        userName: user.userName,
        userPhone: user.phone,
        itemType: itemType,
        buyNum: num,
        startDate: startDate,
        endDate: endDate,
        orderStatus: 1, // 待支付
        createTime: new Date().toISOString(),
        // 从套餐获取价格
        unitPrice: combo.unitPrice,
        totalAmount: combo.unitPrice * num * dateRange.length,
      };

      // ========== 发送MQ异步处理 ==========
      await queueService.addOrderJob({
        ...orderData, // 包含所有订单信息
        rollbackStock: true, // 是否需要回滚库存
        roomTypeId: roomType.id, // 房型id
        dateRange: dateRange, // 日期范围
      });

      // ==========  发送延迟取消任务 ==========
      await queueService.addCancelJob({
        orderNo: orderNo, // 订单号
        packageItemId: combo.id, // 套餐id
        roomTypeId: roomType.id, // 房型id
        userId: userId, // 用户id
        count: num, // 购买数量
        dateRange: dateRange, // 日期范围
        reason: "超时未支付",
      });

      return res.json(
        util.success("订单创建成功，请尽快支付", {
          orderNo: orderNo,
          expireTime: Date.now() + 10 * 60 * 1000,
        })
      );

      // 票务
    } else if (itemType == 2) {

    }
  } catch (error) {
    return res.json(util.fail("系统错误", error.message));
  }
};

// generateNights 已抽取到 utils/dateHelper.js（含结束日语义）

// 初始化库存（如果Redis中不存在）
/**
 *
 * @param {*} combo  套餐对象
 * @param {*} roomPackage 房间套餐对象
 * @param {*} roomType 房型对象
 * @param {*} dateRange 日期范围
 */
async function initializeStockIfNeeded(combo, roomPackage, roomType, dateRange) {
  for (const date of dateRange) {
    // 检查套餐库存
    const comboStockKey = `combo:stock:${combo.id}:${date}`;
    let comboStock = await redisService.getFun(comboStockKey, false);

    if (!comboStock) {
      const datePrice = await PackageDatePrice.findOne({
        where: { packageItemId: combo.id, date: date },
      });

      const stock = datePrice
        ? datePrice.availableStock || combo.maxSaleNum
        : combo.maxSaleNum;
      await comboPurchaseService.initializeComboStock(combo.id, date, stock);
    }

    // 检查酒店房型库存
    const hotelStockKey = `hotel:roomtype:stock:${roomType.id}:${date}`;

    console.log("查询库存1", hotelStockKey);
    let hotelStock = await redisService.getFun(hotelStockKey, false);

    console.log("查询库存2", hotelStock);

    if (!hotelStock) {
      console.log(roomPackage.id, "查询条件", date);
      // 房型共享库存从 RoomInventory 读取（按 roomTypeId + date）
      const roomInventory = await RoomInventory.findOne({
        where: { roomTypeId: roomType.id, date: date },
      });
      console.log("查询日期库存", roomInventory);
      const stock = roomInventory
        ? roomInventory.availableStock || roomType.stock
        : roomType.stock;

      console.log("选择库存", stock);

      await comboPurchaseService.initializeStock(hotelStockKey, stock);
      console.log("检查酒店房型库存", hotelStockKey);
      continue;
    }
  }
}

// 库存回滚
/**
 *
 * @param {*} dateRange 日期范围
 * @param {*} packageItemId 产品套餐id
 * @param {*} roomTypeId  房型id
 * @param {*} quantity  数量
 */

async function rollbackStock(dateRange, packageItemId, roomTypeId, quantity) {
  for (const date of dateRange) {
    const stockKeys = [
      `combo:stock:${packageItemId}:${date}`,
      `hotel:roomtype:stock:${roomTypeId}:${date}`,
    ];
    await comboPurchaseService.refundStock(stockKeys, quantity);
  }
}
