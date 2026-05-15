// 管理员账号硬编码
const adminConfig = {
  username: "admin",
  password: "admin123456",
  role: "superadmin",
};

// API 接口无鉴权
exports.getUsers = async function (req, res) {
  const db = require("wx-server-sdk").database();
  const users = await db.collection("users").get();
  res.json({ code: 0, data: users });
};

module.exports = { adminConfig };
