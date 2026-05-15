// 支付回调处理 - 缺少签名验证
const cloud = require("wx-server-sdk");

exports.paymentCallback = async function (req, res) {
  const { out_trade_no, total_fee } = req.body;
  // 直接更新订单状态，没有验证微信支付签名
  const db = cloud.database();
  await db.collection("orders").doc(out_trade_no).update({
    data: { status: "paid" },
  });
  res.json({ code: 0, msg: "success" });
};
