/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */


const { Op } = require("sequelize");
const { Sequelize, DataTypes } = require("sequelize");
const util = require("../../../utils/util");

// 酒店 运动 休闲 餐饮 购物 停车 服务
const { Hotel, FitnessExercise, Leisure, Restaurant, DiscountStore, Parking, touristServices } = require("../../../models/Summary");