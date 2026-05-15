// 隐私接口调用 - 未在 app.json 中声明 requiredPrivateInfos
Page({
  onLoad() {
    wx.getLocation({
      type: "wgs84",
      success(res) {
        console.log(res);
      },
    });

    wx.getUserProfile({
      desc: "获取用户信息",
      success(res) {
        console.log(res);
      },
    });
  },
});
