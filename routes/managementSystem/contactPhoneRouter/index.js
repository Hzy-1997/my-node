const express = require('express');
const router = express.Router()

const contactPhone = require("./contactPhone")


// 联系电话操作（创建/更新/删除）
router.post("/contactPhoneOperation", contactPhone.contactPhoneOperation)
// 联系电话列表
router.get("/contactPhoneList", contactPhone.contactPhoneList)


module.exports = router
