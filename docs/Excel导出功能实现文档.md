# Excel 导出功能实现文档（使用 exceljs）

> 本文档介绍如何使用 exceljs 库实现订单列表和退款记录的 Excel 导出功能 今天没有更新吧？

---

## 一、安装依赖

```bash
npm install exceljs
```

---

## 二、基础用法

### 2.1 最简单的导出

```javascript
const ExcelJS = require("exceljs");

async function simpleExport() {
  // 1. 创建工作簿
  const workbook = new ExcelJS.Workbook();

  // 2. 添加工作表
  const worksheet = workbook.addWorksheet("订单列表");

  // 3. 添加表头
  worksheet.addRow(["订单号", "用户", "金额", "状态"]);

  // 4. 添加数据
  worksheet.addRow(["ORD001", "张三", 199, "已支付"]);
  worksheet.addRow(["ORD002", "李四", 299, "已退款"]);

  // 5. 保存文件
  await workbook.xlsx.writeFile("订单列表.xlsx");
  console.log("导出成功！");
}

simpleExport();
```

---

## 三、订单列表导出（完整示例）

### 3.1 后端代码（Node.js）

```javascript
const ExcelJS = require("exceljs");
const { Order, Member } = require("../models/Summary");

/**
 * 导出订单列表
 * GET /api/orders/export
 */
exports.exportOrders = async (req, res) => {
  try {
    // 1. 查询订单数据（支持筛选条件）
    const { startDate, endDate, status } = req.query;

    const where = {};
    if (status) where.orderStatus = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["name", "phone"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. 创建工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("订单列表");

    // 3. 设置表头（带样式）
    const headers = [
      { header: "订单号", key: "orderNumber", width: 25 },
      { header: "用户姓名", key: "userName", width: 15 },
      { header: "手机号", key: "userPhone", width: 15 },
      { header: "票务名称", key: "title", width: 20 },
      { header: "购买数量", key: "buyNum", width: 12 },
      { header: "订单金额", key: "orderAmount", width: 15 },
      { header: "订单状态", key: "orderStatus", width: 12 },
      { header: "游玩日期", key: "playDate", width: 15 },
      { header: "创建时间", key: "createdAt", width: 20 },
    ];

    worksheet.columns = headers;

    // 4. 表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4472C4" }, // 蓝色背景
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // 5. 添加数据
    orders.forEach((order) => {
      worksheet.addRow({
        orderNumber: order.orderNumber,
        userName: order.userName,
        userPhone: order.userPhone,
        title: order.title,
        buyNum: order.buyNum,
        orderAmount: order.orderAmount,
        orderStatus: getOrderStatusText(order.orderStatus),
        playDate: order.playDate,
        createdAt: formatDate(order.createdAt),
      });
    });

    // 6. 数据行样式
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: "middle" };

        // 金额列右对齐
        row.getCell("orderAmount").alignment = { horizontal: "right" };

        // 隔行变色
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F2F2F2" }, // 浅灰色
          };
        }
      }
    });

    // 7. 添加边框
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };
      });
    });

    // 8. 生成文件名
    const fileName = `订单列表_${formatDate(new Date(), "YYYYMMDD")}.xlsx`;

    // 9. 写入响应
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${encodeURIComponent(fileName)}`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("导出订单失败:", error);
    res
      .status(500)
      .json({ code: 500, message: "导出失败", error: error.message });
  }
};

// 辅助函数：获取订单状态文本
function getOrderStatusText(status) {
  const statusMap = {
    1: "待支付",
    2: "待核销",
    3: "已取消",
    4: "已完成",
    5: "已退款",
  };
  return statusMap[status] || "未知";
}

// 辅助函数：格式化日期
function formatDate(date, format = "YYYY-MM-DD HH:mm:ss") {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");

  return format
    .replace("YYYY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hour)
    .replace("mm", minute)
    .replace("ss", second);
}
```

### 3.2 路由配置

```javascript
// routes/managementSystem/orderRouter/index.js
const express = require("express");
const router = express.Router();
const orderController = require("../../../controllers/orderController");

// 导出订单
router.get("/export", orderController.exportOrders);

module.exports = router;
```

### 3.3 前端代码（Vue）

```vue
<template>
  <div>
    <el-button type="primary" @click="exportOrders">
      <i class="el-icon-download"></i> 导出订单
    </el-button>
  </div>
</template>

<script>
import axios from "axios";

export default {
  methods: {
    async exportOrders() {
      try {
        const response = await axios.get("/api/orders/export", {
          params: {
            startDate: this.searchForm.startDate,
            endDate: this.searchForm.endDate,
            status: this.searchForm.status,
          },
          responseType: "blob", // 重要：接收二进制数据
        });

        // 创建下载链接
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);

        // 从响应头获取文件名
        const contentDisposition = response.headers["content-disposition"];
        let fileName = "订单列表.xlsx";
        if (contentDisposition) {
          const match = contentDisposition.match(
            /filename\*?=(?:UTF-8'')?([^;]+)/,
          );
          if (match) {
            fileName = decodeURIComponent(match[1].replace(/['"]/g, ""));
          }
        }

        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.$message.success("导出成功");
      } catch (error) {
        console.error("导出失败:", error);
        this.$message.error("导出失败");
      }
    },
  },
};
</script>
```

---

## 四、退款记录导出（完整示例）

### 4.1 后端代码

```javascript
const ExcelJS = require("exceljs");
const { RefundOrder, Order } = require("../models/Summary");

/**
 * 导出退款记录
 * GET /api/refunds/export
 */
exports.exportRefunds = async (req, res) => {
  try {
    // 1. 查询退款数据
    const { startDate, endDate, status } = req.query;

    const where = {};
    if (status) where.refundStatus = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const refunds = await RefundOrder.findAll({
      where,
      include: [
        {
          model: Order,
          as: "order",
          attributes: ["title", "buyNum"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. 创建工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("退款记录");

    // 3. 设置表头
    worksheet.columns = [
      { header: "退款单号", key: "refundNo", width: 25 },
      { header: "原订单号", key: "orderNo", width: 25 },
      { header: "用户手机号", key: "userPhone", width: 15 },
      { header: "退款金额", key: "refundAmount", width: 15 },
      { header: "退款原因", key: "refundReason", width: 20 },
      { header: "退款状态", key: "refundStatus", width: 12 },
      { header: "退款类型", key: "refundType", width: 12 },
      { header: "审核时间", key: "auditTime", width: 20 },
      { header: "退款完成时间", key: "refundTime", width: 20 },
      { header: "创建时间", key: "createdAt", width: 20 },
    ];

    // 4. 表头样式（绿色主题）
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "70AD47" }, // 绿色背景
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // 5. 添加数据
    refunds.forEach((refund) => {
      const row = worksheet.addRow({
        refundNo: refund.refundNo,
        orderNo: refund.orderNo,
        userPhone: refund.userPhone,
        refundAmount: refund.refundAmount,
        refundReason: refund.refundReason,
        refundStatus: getRefundStatusText(refund.refundStatus),
        refundType: refund.refundType === 1 ? "全额退款" : "部分退款",
        auditTime: formatDate(refund.auditTime),
        refundTime: formatDate(refund.refundTime),
        createdAt: formatDate(refund.createdAt),
      });

      // 根据状态设置行颜色
      const statusCell = row.getCell("refundStatus");
      switch (refund.refundStatus) {
        case 1: // 退款成功
          statusCell.font = { color: { argb: "00B050" } }; // 绿色
          break;
        case 2: // 退款失败
          statusCell.font = { color: { argb: "FF0000" } }; // 红色
          break;
        case 3: // 拒绝退款
          statusCell.font = { color: { argb: "FF6600" } }; // 橙色
          break;
      }
    });

    // 6. 添加统计行
    const totalRow = worksheet.addRow([]);
    const totalAmount = refunds.reduce(
      (sum, r) => sum + parseFloat(r.refundAmount || 0),
      0,
    );

    totalRow.getCell(1).value = "合计";
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(4).value = totalAmount; // 退款金额列
    totalRow.getCell(4).font = { bold: true, color: { argb: "FF0000" } };
    totalRow.getCell(4).numFmt = "¥#,##0.00";

    // 7. 添加边框和对齐
    worksheet.eachRow((row) => {
      row.alignment = { vertical: "middle" };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // 8. 设置金额格式
    worksheet.getColumn("refundAmount").numFmt = "¥#,##0.00";

    // 9. 写入响应
    const fileName = `退款记录_${formatDate(new Date(), "YYYYMMDD")}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${encodeURIComponent(fileName)}`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("导出退款记录失败:", error);
    res
      .status(500)
      .json({ code: 500, message: "导出失败", error: error.message });
  }
};

// 辅助函数：获取退款状态文本
function getRefundStatusText(status) {
  const statusMap = {
    1: "退款成功",
    2: "退款失败",
    3: "拒绝退款",
  };
  return statusMap[status] || "未知";
}
```

---

## 五、高级功能

### 5.1 多 Sheet 导出

```javascript
const workbook = new ExcelJS.Workbook();

// 第一个 Sheet - 订单
const orderSheet = workbook.addWorksheet("订单列表");
orderSheet.columns = [
  { header: "订单号", key: "orderNumber" },
  { header: "金额", key: "amount" },
];

// 第二个 Sheet - 退款
const refundSheet = workbook.addWorksheet("退款记录");
refundSheet.columns = [
  { header: "退款单号", key: "refundNo" },
  { header: "金额", key: "amount" },
];

// 分别添加数据...
```

### 5.2 合并单元格

```javascript
// 合并表头
worksheet.mergeCells("A1:D1");
worksheet.getCell("A1").value = "订单报表";
worksheet.getCell("A1").font = { size: 16, bold: true };
worksheet.getCell("A1").alignment = { horizontal: "center" };
```

### 5.3 添加公式

```javascript
// 在最后一行添加求和公式
const lastRow = worksheet.rowCount;
worksheet.getCell(`C${lastRow}`).value = { formula: `SUM(C2:C${lastRow - 1})` };
```

### 5.4 列宽自适应

```javascript
worksheet.columns.forEach((column) => {
  let maxLength = 0;
  column.eachCell({ includeEmpty: true }, (cell) => {
    const length = cell.value ? cell.value.toString().length : 0;
    if (length > maxLength) maxLength = length;
  });
  column.width = Math.min(maxLength + 2, 50); // 最大50
});
```

---

## 六、常见问题

### Q1: 中文文件名乱码？

```javascript
// 使用 encodeURIComponent
res.setHeader(
  "Content-Disposition",
  `attachment; filename="${encodeURIComponent(fileName)}"`,
);
```

### Q2: 大数据量导出内存溢出？

```javascript
// 使用流式写入
await workbook.xlsx.write(res, { stream: true });
```

### Q3: 日期格式显示不正确？

```javascript
// 明确设置单元格格式
cell.numFmt = "yyyy-mm-dd hh:mm:ss";
// 或
cell.value = new Date(date);
```

---

## 七、总结

| 功能     | 实现方式                            |
| -------- | ----------------------------------- |
| 基础表格 | `worksheet.addRow()`                |
| 表头样式 | `headerRow.font / fill / alignment` |
| 数据筛选 | 查询时添加 `where` 条件             |
| 状态颜色 | 根据条件设置 `cell.font.color`      |
| 金额格式 | `cell.numFmt = '¥#,##0.00'`         |
| 下载文件 | `responseType: 'blob'`              |

---

需要我帮你实现具体的导出功能吗？比如导出退款记录页面？
