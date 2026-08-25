# Belcheck QX AdBlock

一套以真实流量证据、低误伤和可回滚为原则的 Quantumult X 广告屏蔽项目。它既提供针对具体广告链路的独立规则与响应改写，也提供一份由作者最新自用配置最小脱敏而来的完整公开模板。

这个项目不追求“拦得越多越好”。每条自研规则都尽量限定在已确认的接口、字段、路径或素材主机；无法确认的数据保持原样放行。第三方通用规则通过原作者地址引用，不复制后改名，也不把别人的工作包装成自研成果。

## 直接使用完整公开配置

公开配置：[`Config/Belcheck-QX-Public.conf`](Config/Belcheck-QX-Public.conf)

Raw 订阅地址：

```text
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Config/Belcheck-QX-Public.conf
```

使用方法：

1. 在 Quantumult X 的配置文件页面通过上述 Raw 地址下载配置，并将其设为当前配置。
2. 更新全部远程资源后，重新连接 Quantumult X。
3. 需要响应重写时，在 Quantumult X 中生成自己的 CA，安装并完全信任；公开配置不携带任何证书或口令。
4. 彻底关闭再打开目标 App，避免旧响应和页面缓存影响判断。

这份模板可以在没有代理节点的情况下直接加载：`[server_local]` 与 `[server_remote]` 有意保持为空，国外流量、AI、Telegram、YouTube、Netflix 等策略默认回退为 `direct`。如需代理，请只在自己的设备中添加节点或订阅，再按需调整策略；不要把私人配置回传到公共仓库。

会员解锁、广告净化、网页优化和功能增强模块均按作者自用配置保留。它们来自第三方、可独立启停，默认状态以配置文件为准。使用前请阅读对应作者说明，并自行判断服务条款、地区规则、兼容性和账户风险。

## 项目组成

### 自研低误伤模块

#### 美团单车微信小程序

- 精确改写首页、Hermes 资源与结算页三个 JSON 接口。
- 删除腾讯微信广告及非 `MOBIKE` 广告策略项。
- 支持结算页 `adsResource[].infos` 的嵌套广告分组。
- 确认广告后同时移除已空的广告父容器，减少黑色弹窗或空白占位。
- 保留骑行、结算、支付数据和 `MOBIKE` 自营内容。

#### 小红书 App

- 仅处理 `rec.xiaohongshu.com/api/sns/v6/homefeed`。
- 只删除带有 `is_ads=true`、`model_type=advertisement`，或 `ads_info.ads_id` / `ads_info.ads_type` 强标记的直接数组项。
- 普通笔记、直播卡片、分页字段、未知结构及异常响应保持不变。

#### 美团 App

- 仅拒绝 `p0.meituan.net`、`p1.meituan.net` 下的 `/adunion/` 素材请求。
- 不封禁共享 CDN 整域，也不扩展成整个 `meituan.net` 拦截。
- 当前只处理已确认素材，不虚构未捕获的广告卡片字段。

### 公开配置整合

- `blackmatrix7/ios_rule_script` 的广告、隐私、反劫持、国内应用、AI 服务、流媒体及全球分流规则。
- `ddgksf2013` 维护的广告净化、开屏处理、网页优化、功能增强与会员模块。
- 资源解析、流媒体查询、VVebo、BoxJS、图标及少量补充规则。
- localhost、本地网段、DNS、MitM hostname 和策略组等完整配置结构。

## 只安装自研模块

已有自己的 Quantumult X 配置时，不必替换整份配置。在 `[rewrite_remote]` 中加入：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanBikeWeChatAds.snippet, tag=美团单车微信广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/XiaohongshuHomeFeedAds.snippet, tag=小红书首页广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanAppAdMedia.snippet, tag=美团App广告素材清理, update-interval=86400, opt-parser=false, enabled=true
```

在 `[filter_remote]` 中加入微信广告素材兜底：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Filters/WeChatMiniProgramAds.list, tag=微信广告素材, force-policy=reject, update-interval=86400, opt-parser=false, enabled=true
```

随后确认 Rewrite 与 MitM 已启用、CA 已安装并完全信任、远程资源已经更新。不要同时加载会改写同一小红书 `homefeed` 接口的其他模块。

## 设计原则

- **证据优先**：自研规则来自抓包与界面对照，不从空响应或未知字段猜测广告结构。
- **最小匹配**：优先使用精确接口、路径、强广告字段和已验证素材主机。
- **异常放行**：JSON 解析失败、结构变化或非目标请求均原样返回。
- **独立启停**：不同 App 的规则拆分为独立模块，出现兼容问题时可单独关闭。
- **不提交真实数据**：测试数据全部人工合成；真实请求、响应、标识符和素材不进入仓库。

## 证据边界

- 美团单车结算响应曾在两个嵌套分组中明确下发腾讯微信弹窗与视频广告项，因此规则只扩展到对应精确接口与广告容器。
- 小红书样本包含 12 次首页响应、116 个信息流条目，其中 1 个带完整广告结构；普通笔记与直播条目不具备该结构。
- 美团 App 样本中，`p0/p1` 的 56 次素材请求有 6 次位于 `/adunion/`，对应 4 个广告创意；其他约 50 次正常素材位于不同路径，因此不能整域封禁。
- 小红书开屏、广告资源和广告行为接口在样本中为空响应，没有据此编写未知 JSON 结构。
- 埋点、会员、支付、消息、HTTPDNS 与风控请求不自动等同于广告，不属于当前自研删除范围。

这些数字用于说明规则边界。真实抓包、请求头、账户标识、设备信息和位置数据均不公开。

## 文件结构

- `Config/Belcheck-QX-Public.conf`：可直接导入的完整脱敏配置。
- `Scripts/`：自研响应过滤实现。
- `Rewrite/`：可独立启停的 Quantumult X 远程模块。
- `Filters/`：抓包确认的精确素材主机规则。
- `Tests/`：人工合成回归测试与公开配置隐私检查。
- `Tools/secret-scan.sh`：当前文件和完整 Git 历史的敏感内容检查。
- `THIRD_PARTY.md`：第三方资源来源、边界和完整致谢。

## 验证

仓库测试不需要安装第三方依赖：

```bash
npm test
npm run scan:secrets
```

测试覆盖目标 URL、广告对象删除、正常内容保留、路径误伤边界、重复执行、异常放行，以及公开配置中的空节点段、直连回退、会员模块保留和敏感信息禁入。自动化测试不能替代 Quantumult X 解析器、CA、MitM 和目标 App 的实机验证。

## 隐私与安全

公开配置保留了所有不涉及个人隐私的原配置内容，只移除了：

- 本地代理节点及其认证信息。
- 远程订阅地址及订阅说明。
- CA 口令、证书容器和其他私钥材料。
- 删除节点后不再成立的测速策略与 `proxy` 引用。

请勿在 Issue、Pull Request、测试数据或讨论中上传私人配置、节点、订阅、证书、网络活动导出、HAR、PCAP、真实请求响应、账户标识、设备标识或精确位置。详见 [`SECURITY.md`](SECURITY.md)。

## 已知限制

- 第三方远程资源可能随时更新、迁移或停止维护；启用前应审阅上游说明，重要环境建议固定到已审计版本。
- 不同模块可能命中同一接口或 hostname。出现登录、图片、支付、评论或页面异常时，应先单独停用最近启用的模块。
- MitM 会增加证书固定和兼容风险；公开配置不会替用户生成、分发或备份 CA。
- 素材拒绝可能留下文字卡片或空白占位；没有可靠结构化响应时，不会为了“看起来更干净”而扩大拦截范围。
- 无代理节点的公开配置不会提供跨地区访问或流媒体解锁能力，相关策略只会直连。

## 致谢

特别感谢 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) 对分流规则体系的长期维护，以及 [ddgksf2013](https://github.com/ddgksf2013) 对 Quantumult X 广告净化、网页优化与功能模块的持续整理。也感谢配置中每一项资源的原作者；完整名单与使用边界见 [`THIRD_PARTY.md`](THIRD_PARTY.md)。

本项目与 Quantumult X、上述作者及相关服务没有隶属或官方合作关系。
