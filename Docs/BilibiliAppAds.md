# 哔哩哔哩 App 广告补丁

本模块依据 2026-10-18 用户提供的网络记录独立实现。处理新版 `View/AIRelateAsync` 中混合的广告推荐卡、`/x/v2/splash/list` 商业开屏，以及首页中带明确广告身份的卡片。

## 安装

在现有配置 `[rewrite_remote]` 中添加一行：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/BilibiliAppAds.snippet, tag=哔哩哔哩App广告补丁, update-interval=86400, opt-parser=false, enabled=true
```

保存后更新远程重写资源，确认重写、MitM 已开启且证书已安装并信任，重连 Quantumult X，再完全退出并打开 Bilibili。这个补丁只新增上述接口的规则，可以独立停用。订阅文件自带所需 hostname，不需修改个人证书或代理节点。

维护时发现旧 `https://ddgksf2013.top/rewrite/BiliBiliAdsLite.conf` 返回 HTML 页面；如你的配置仍使用这个地址，可停用这一条并启用本补丁。其他 Bilibili 模块如果也改写同一接口，请将本补丁排在它前面，并在资源更新后检查实际命中情况；不同改写不能假定自动叠加。历史配置中的第三方功能可能超出本补丁范围。

## 处理边界

- 相关推荐只过滤类型为 5、内部 Any 明确为 `bilibili.ad.v1.SourceContentDto` 且有非空广告 payload 的卡片。普通视频、番剧、其他卡片、分页和配置字段按原始字节保留。
- 顶层同类型广告源只删除广告 payload，保留控制参数、类型和元数据。未知类型、损坏帧、不支持的压缩格式原样放行。
- gRPC 支持 identity 和 gzip；自行校验帧长、gzip 校验和及解压大小。输出保持原压缩标记，重新计算压缩后帧长。脚本内嵌 fflate，无运行时下载或网络调用。
- 商业开屏按 `is_ad`、`is_ad_loc` 等明确标记清理。当前列表全部是广告时，同时清空旧广告播放排期和缓存保留列表；混合列表仅移除被删广告的关联排期。
- 首页只清理明确广告标记；本次两份首页响应没有符合条件的广告，完全保持原样。首页有广告的分支目前只有合成测试证据。
- 不改品牌开屏壁纸、普通播放、弹幕、评论或其他接口，不整域封锁共用图片、视频 CDN。

## 验证结果

本地重放 144 个 JSON/gRPC 响应，恰好修改 4 个相关推荐响应和 1 个商业开屏响应，139 个保持不变。相关推荐删除 7 张广告卡，保留 44 张正常卡；开屏清理 84 条广告、25 条排期和 38 个缓存保留 ID。二次运行不再改变响应。

真实抓包、请求参数、响应、个人完整配置和凭据均不放入仓库。测试使用手写合成数据。以上验证是本地响应回放，尚未完成手机端导入、规则命中和可见界面验收。已缓存的开屏素材可能需要清理 Bilibili 缓存后再试。

## 回退

停用 `哔哩哔哩App广告补丁`，保存并重连 Quantumult X。无需替换整份个人配置。

## 依据

- [Quantumult X 官方二进制改写示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-bytes-rewrite.js)
- [gRPC HTTP/2 帧协议](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md)
- [fflate](https://github.com/101arrowz/fflate)，MIT，完整许可证保留在脚本头部。
