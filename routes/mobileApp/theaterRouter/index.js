const { Op } = require('sequelize');
// const sequelize = require('../../mysql/index');
const { Sequelize, DataTypes } = require('sequelize');
const util = require("../../../utils/util");


const { Ticket } = require("../../../models/Summary")



// 创建门票
exports.createTicket = async (req, res) => {
    try {
        const { id, action } = req.body;
        if (action) return res.json(util.fail("缺少必要参数"))

        if (action == "create") {

        }


    } catch (error) {

    }

}


exports.ticketList = async (req, res) => {
    try {
        const { id } = req.query;
        const tickets = await Ticket.findAll({
            where: {
                category: id
            }
        })
        res.json(util.success(tickets));
    } catch (error) {
    }
}