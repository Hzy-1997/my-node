
const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../../mysql/index");

const CompensationTask = sequelize.define(
  "CompensationTask",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '任务类型，如 seat_release',
    },
    orderNo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '订单号',
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '票务ID',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID',
    },
    seats: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '座位信息',
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      comment: '状态：pending, success, failed',
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '重试次数',
    },
    maxRetry: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      comment: '最大重试次数',
    },
    expireTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '任务过期时间',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '完成时间',
    },
  },
  {
    tableName: "compensation_tasks",
    timestamps: true,
    indexes: [
      {
        fields: ["orderNo"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["createdAt"],
      },
    ],
  },
);


module.exports = {
  CompensationTask
};
