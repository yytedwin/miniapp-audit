// 订单创建 - 金额信任前端传入
const cloud = require("wx-server-sdk");

exports.createOrder = async function (req, res) {
  const amount = req.body.amount; // 直接使用前端传来的金额，可被篡改
  const order = {
    amount,
    status: "pending",
    createTime: new Date(),
  };
  const db = cloud.database();
  await db.collection("orders").add({ data: order });
  res.json({ code: 0, data: order });
};

// 订单查询 - 无归属校验 (IDOR)
exports.getOrder = async function (req, res) {
  const { orderId } = req.params;
  const db = cloud.database();
  // 没有校验订单是否属于当前用户
  const order = await db.collection("orders").doc(orderId).get();
  res.json({ code: 0, data: order.data });
};
