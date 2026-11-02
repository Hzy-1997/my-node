const express = require("express")
const router = express.Router()
const dictTypeController = require("./dictType")

// 字典类型操作
router.post("/dictTypeOperate", dictTypeController.field)
// 字典类型列表
router.get("/getDictTypeList", dictTypeController.getDictTypeList)
// 字典数据操作
router.post("/dictDataOperate", dictTypeController.dictDataField)
// 字典数据列表
router.get("/getDictDataList", dictTypeController.getDictDataList)
// 前端按类型取字典数据（下拉选项等）
router.get("/getDictDataByType", dictTypeController.getDictDataByType)

module.exports = router
