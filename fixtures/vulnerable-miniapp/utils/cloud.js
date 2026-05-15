// 腾讯云密钥硬编码
const COS = require("cos-wx-sdk-v5");

const cos = new COS({
  SecretId: "AKIDvulnerabletestkey12345678",
  SecretKey: "vulnerableSecretKeyForTest12345",
});
