# Belcheck QX AdBlock

一套基于真实流量验证、尽量低误伤的 Quantumult X 广告屏蔽策略。当前覆盖美团单车微信小程序、小红书首页信息流，以及本次已验证的美团 App `/adunion/` 广告素材。

仓库只包含广告规则、响应改写脚本、人工合成测试数据和文档。完整 Quantumult X 配置、代理节点、订阅、证书、网络活动导出及真实抓包不会进入仓库。

## 当前模块

### 美团单车微信小程序

- 精确改写两个美团单车 JSON 接口。
- 删除腾讯微信广告及非 `MOBIKE` 广告策略项。
- 保留骑行数据和 `MOBIKE` 自营内容。
- 以两个已验证微信广告素材域作为兜底。

### 小红书 App

- 仅处理 `rec.xiaohongshu.com/api/sns/v6/homefeed`。
- 只删除带有 `is_ads=true`、`model_type=advertisement`，或 `ads_info.ads_id` / `ads_info.ads_type` 强标记的直接数组项。
- 普通笔记、直播卡片、分页字段及其他接口保持不变。

### 美团 App

- 仅拒绝 `p0.meituan.net`、`p1.meituan.net` 下的 `/adunion/` 素材请求；本次样本均为图片。
- 其他共享 CDN 路径不会被规则主动拒绝；不会扩展成整域或整个 `meituan.net` 拦截。
- 本次抓包没有出现可可靠改写的广告卡片 JSON，因此当前版本只处理已确认素材，不虚构响应字段。

## Quantumult X 安装

在主配置的 `[rewrite_remote]` 中加入：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanBikeWeChatAds.snippet, tag=美团单车微信广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/XiaohongshuHomeFeedAds.snippet, tag=小红书首页广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanAppAdMedia.snippet, tag=美团App广告素材清理, update-interval=86400, opt-parser=false, enabled=true
```

在 `[filter_remote]` 中加入微信小程序素材兜底：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Filters/WeChatMiniProgramAds.list, tag=微信小程序广告素材, force-policy=reject, update-interval=86400, opt-parser=false, enabled=true
```

随后确认：

- Quantumult X 的 Rewrite 与 MitM 已启用。
- Quantumult X CA 已在设备上安装并完全信任。
- 更新远程资源后重连 Quantumult X，并彻底关闭再打开目标 App。
- 不要同时加载其他会改写同一小红书 `homefeed` 接口的模块。

美团 App 模块会对 `p0.meituan.net`、`p1.meituan.net` 两个完整主机启用 MitM，但只对 `/adunion/` 路径执行 `reject-img`。即使其他路径不会被主动拒绝，MitM 本身仍可能带来证书固定或兼容问题；若出现正常图片异常，可单独停用“美团App广告素材清理”，其他两个模块不受影响。

## 抓包证据边界

- 小红书：12 次首页响应共 116 个信息流条目，发现 1 个带完整广告结构的条目；其余普通笔记与直播均无该结构。
- 美团 App：`p0/p1` 共 56 次素材请求，其中 6 次位于 `/adunion/`、对应 4 个广告创意；其余约 50 次位于商家、商品、评价、频道等非 `/adunion/` 路径，因此只允许匹配该目录。
- 小红书开屏、广告资源和广告行为接口在本次导出中为空响应，没有据此编写未知 JSON 结构。
- 美团埋点、会员、支付、消息、HTTPDNS 与风控请求不属于本次广告组件删除范围。

以上数字只用于说明规则边界；真实请求、响应、标识符和素材均未进入仓库。

## 文件结构

- `Scripts/MeituanBikeWeChatAds.js`：美团单车响应过滤实现。
- `Scripts/XiaohongshuHomeFeedAds.js`：小红书首页广告对象过滤实现。
- `Rewrite/`：三个可独立启停的远程模块。
- `Filters/WeChatMiniProgramAds.list`：微信小程序已验证素材域兜底。
- `Tests/`：完全人工合成、无真实用户数据的回归测试。
- `Tools/secret-scan.sh`：提交白名单、当前文件与完整 Git 历史敏感内容检查。

## 验证

仓库测试无第三方依赖：

```bash
npm test
npm run scan:secrets
```

测试覆盖目标 URL、广告删除、正常内容保留、路径误伤边界、重复执行和异常原样放行。本地 Node 测试不替代 Quantumult X 解析器、CA、MitM 和目标 App 的实机验证。

## 已知限制

- 美团 App 当前规则按路径处理请求，不检查响应 MIME；可阻止已确认广告图片，但可能留下文字卡片或空白占位。需要抓到广告决策 JSON 后才能安全删除整个组件。
- 小红书页面可能缓存旧响应。更新模块后应重启隧道和 App，再观察新请求。
- `main` 分支 Raw 地址会随仓库更新。需要固定行为时，可将 URL 中的 `main` 替换为已审计的 Release 标签或完整提交哈希。

## 隐私与安全

请勿在 Issue、Pull Request 或测试数据中上传完整配置、网络活动导出、真实请求头、真实响应、账户标识、精确位置或证书材料。详见 [SECURITY.md](SECURITY.md)。
