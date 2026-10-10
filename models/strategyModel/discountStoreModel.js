// 购物折扣店模型

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

const DiscountStore = sequelize.define("DiscountStore", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: "主键ID",
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "店名（如：THAIWOO 太舞品牌折扣店）",
  },
  subtitle: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    comment: "1 自营 2 非自营 （默认自营）",
  },
  shortDesc: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "简短描述（如：专业的滑雪户外品牌折扣店）",
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '标签列表（如：["高尔夫", "专业练习场"]）',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: "详细介绍",
  },
  carouselImages: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: "轮播图列表",
  },
  businessHours: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "营业时间（如：08:30-22:00）",
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "联系电话",
  },
  locationDesc: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "位置描述（如：北京市海淀区）",
  },
  locationLink: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "位置链接",
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "品类（如：运动品牌 / 服装）",
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: "1",
    comment: "状态 (1: 正常, 2: 已下架",
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "排序权重",
  },
});

module.exports = {
  DiscountStore,
};
