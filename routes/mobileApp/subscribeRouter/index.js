/*
 * @描述: 
 * @版本: 
 * @作者: 
 * @日期: ${year}-${month}-${day}
 * @最后编辑者: sueRimn
 * @最后编辑时间: ${year}-${month}-${day} ${hour}:${minute}:${second}
 */

const express = require("express")
const router = express.Router()

const reminderController = require("./reminder.js");

router.post("/reminder", reminderController.reminder);


module.exports = router;
