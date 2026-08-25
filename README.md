# Belcheck QX AdBlock

**Quantumult X 公开配置 · 广告净化 · 应用分流 · 抓包验证 · 隐私脱敏**

Update on 2026-08-25 · Public Config `2.5-public`

> [!IMPORTANT]
> **禁止公众号、自媒体对本仓库的整理内容、自研文件或完整配置进行任何形式的转载、镜像或重新发布。** 如需分享，请直接使用本仓库原始链接，并保留 Belcheck 与各上游作者的署名。

## 特别声明

1. 本项目主要用于学习和研究 Quantumult X 规则、JavaScript 及网络请求机制，无法保证所有内容在任何时间、地区、设备或应用版本下均合法、准确、完整且有效。
2. 本项目中任何需要使用者自行填写的数据，均由使用的个人或组织自行负责。本项目不对这些数据的真实性、准确性、合法性或安全性承担责任；由此产生的后果由使用者自行承担。
3. 本项目涉及的第三方硬件、软件、应用与网络服务，与本项目不存在直接或间接的隶属、合作或担保关系。项目中的客观描述不代表对任何第三方产品或服务的认可。
4. 本项目全部内容仅供学习与研究，不得用于违反国家、地区、组织或服务条款的用途。使用者有责任了解并遵守所在地法律法规及相关平台规则。
5. 基于本项目源码、规则或配置进行的修改与再开发，属于修改者的自主行为，与本项目及其维护者不存在直接或间接关系；相关后果由修改者自行承担。
6. 所有直接或间接使用本项目的个人与组织，应在 24 小时内完成学习和研究，并及时删除本地保存的相关内容；如确需长期使用，应自行审计、开发并维护所需功能。
7. 第三方规则、脚本、图标与工具的版权、许可证、署名要求和免责声明均归其原作者所有。本仓库仅保留原始引用地址，不授予超出上游条款的使用权。
8. 本项目保留随时补充或修改本声明的权利。继续访问、引用或使用本项目内容，视为已经阅读并接受本声明。

Belcheck QX AdBlock 是一套可直接导入、也可拆分订阅的 Quantumult X 配置。它以作者的日常配置为基础，整合社区长期维护的分流与重写资源，并加入基于真实流量验证的低误伤广告模块。

这里不追求“规则越多越好”。自研规则只处理已经确认的接口、字段、路径或素材主机；结构不明、响应异常或证据不足时保持原样放行。

> [!NOTE]
> 公开配置不包含 VPN 节点、代理订阅、认证信息、CA 口令或证书容器。`[server_local]` 与 `[server_remote]` 有意保持为空，所有需要代理的策略默认回退为 `direct`。会员与功能增强模块来自第三方，使用条件、兼容性和账户风险以原作者说明为准。

## 1️⃣ Quantumult X 完整公开配置

| 项目 | 说明 |
| --- | --- |
| 配置文件 | [`Config/Belcheck-QX-Public.conf`](Config/Belcheck-QX-Public.conf) |
| 更新时间 | 2026-08-25 |
| 默认网络 | 无代理节点，全部策略可回退为 `direct` |
| 主要功能 | 广告与隐私规则、应用分流、会员模块、网页优化、功能增强、BoxJS、流媒体查询 |
| 隐私状态 | 已移除节点、订阅、凭据、CA 与真实抓包数据 |

**Raw 配置地址：**

```text
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Config/Belcheck-QX-Public.conf
```

### 导入方法
<img width="1576" height="901" alt="image" src="https://github.com/user-attachments/assets/99624432-06fc-430c-9989-3fd8f87bd54a" />
<img width="1858" height="846" alt="image" src="https://github.com/user-attachments/assets/1a87dd3a-c015-4c4f-8a70-f7821aedcab6" />
<img width="1851" height="862" alt="image" src="https://github.com/user-attachments/assets/386e0ef9-fea7-4758-9f10-3d0f6adf38e9" />
<img width="1503" height="841" alt="image" src="https://github.com/user-attachments/assets/981fce8c-1345-4485-a8b3-a269f13b2c19" />


1. 打开 Quantumult X，进入右下角风车/三角按钮下的配置文件页面。
2. 通过上面的 Raw 地址下载配置，并将其设为当前配置。
3. 更新全部远程资源，重新连接 Quantumult X。
4. 需要响应重写时，在 Quantumult X 中生成自己的 CA，并在 iOS 中安装、完全信任。
5. 彻底关闭再打开目标 App，避免旧响应或页面缓存影响结果。

如果需要使用自己的代理，请只在本机补充节点或订阅，再调整“国外流量”“AI 服务”“Telegram”“YouTube”“Netflix”等策略。不要把补充后的私人配置提交到公开仓库。

## 2️⃣ 这份配置包含什么

| 类别 | 主要内容 | 来源 | 默认状态 |
| --- | --- | --- | --- |
| 自研广告模块 | 美团单车、小红书首页、美团 App、微信小程序素材 | Belcheck | 开启 |
| 广告与隐私 | Advertising、Privacy、Hijacking | blackmatrix7 | 开启 |
| 会员模块 | 哔哩广告净化 Lite、Spotify、墨鱼专属 VIP | ddgksf2013、app2smile | 开启 |
| 广告净化 | 开屏、彩云、知乎、YouTube、微博、喜马拉雅、高德、网易云、闲鱼等 | 多位社区作者 | 混合 |
| 网页优化 | Safari 超级搜索、豆瓣观影、Google 重定向、CAPTCHA 兼容 | ddgksf2013、NobyDa | 混合 |
| 功能增强 | 小红书、百度网盘、微信 URL、Apple 定位与天气服务 | ddgksf2013、zZPiglet、NSRingo | 混合 |
| 应用分流 | 国内应用、AI、流媒体、Apple、国际流量与中国 ASN | blackmatrix7 等 | 开启 |
| 工具 | 资源解析、流媒体查询、节点信息、BoxJS | KOP-XIAO、ddgksf2013、Chavyleung | 混合 |

“混合”表示部分资源默认关闭，具体以公开配置中的 `enabled=true/false` 为准。

## 3️⃣ 自研低误伤模块

| 模块 | 处理范围 | 不会主动处理 |
| --- | --- | --- |
| 美团单车微信小程序 | 首页、Hermes 资源与结算页三个精确 JSON 接口；删除明确微信广告与非 `MOBIKE` 广告策略 | 骑行、结算、支付数据与 `MOBIKE` 自营内容 |
| 小红书首页信息流 | `rec.xiaohongshu.com/api/sns/v6/homefeed` 中带强广告标记的直接数组项 | 普通笔记、直播、分页字段、未知结构与异常响应 |
| 美团 App 广告素材 | `p0/p1.meituan.net` 下已经确认的 `/adunion/` 图片路径 | 共享 CDN 的其他商家、商品、评价和频道素材 |
| 微信小程序广告素材 | 两个抓包确认的微信小程序广告素材主机 | 整个 `wxs.qq.com`、微信正文、头像与公共 CDN |

### 只安装自研模块

已有自己的 Quantumult X 配置时，不必替换完整配置。在 `[rewrite_remote]` 中加入：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanBikeWeChatAds.snippet, tag=美团单车微信广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/XiaohongshuHomeFeedAds.snippet, tag=小红书首页广告清理, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanAppAdMedia.snippet, tag=美团App广告素材清理, update-interval=86400, opt-parser=false, enabled=true
```

在 `[filter_remote]` 中加入：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Filters/WeChatMiniProgramAds.list, tag=微信小程序广告素材, force-policy=reject, update-interval=86400, opt-parser=false, enabled=true
```

随后确认 Rewrite 与 MitM 已开启、CA 已正确安装、远程资源已经更新。不要同时加载会改写同一小红书 `homefeed` 接口的其他模块。

## 4️⃣ 第三方复写与功能模块

公开配置保留了作者自用配置中不涉及个人隐私的第三方模块。这里只列出实际引用的资源，不把未收录模块写成项目能力。

### 会员与广告净化

| 功能 | 主要维护者或原作者 | 默认 |
| --- | --- | --- |
| 哔哩广告净化 Lite | ddgksf2013 | 开启 |
| Spotify 会员模块 | app2smile | 开启 |
| 墨鱼专属 VIP | ddgksf2013 | 开启 |
| 墨鱼去开屏 2.0 | ddgksf2013 等 | 开启 |
| 彩云天气、知乎、微博、喜马拉雅、高德、网易云、闲鱼净化 | ddgksf2013 及对应原作者 | 开启 |
| YouTube 广告处理 | DivineEngine、app2smile、Maasea、VirgilClyne | 开启 |
| 微信小程序净化 | ddgksf2013 | 关闭 |
| 滴滴净化 | ZenmoFeiShi | 关闭 |
| Adblock4limbo 网页净化 | limbopro | 关闭 |

### 网页优化与功能增强

| 功能 | 主要维护者或原作者 | 默认 |
| --- | --- | --- |
| Safari 超级搜索、豆瓣观影、Google 重定向 | ddgksf2013 | 开启 |
| Google CAPTCHA 兼容 | NobyDa | 关闭 |
| 小红书净化与去水印、百度网盘净化 | ddgksf2013 | 开启 |
| 微信 URL 解锁 | zZPiglet，经 ddgksf2013 整理 | 开启 |
| Apple 定位服务、WeatherKit 增强 | NSRingo | 关闭 |
| VVebo 时间线重写 | bin64/Scripts | 开启 |
| BoxJS | Chavyleung | 关闭 |

第三方模块通过原始地址加载，不复制后改名，也不作为本项目自研成果。上游更新可能改变功能和风险；重要环境建议先审阅资源内容，再决定是否开启。

## 5️⃣ Quantumult X 分流

| 分流类别 | 覆盖内容 | 策略 |
| --- | --- | --- |
| 广告与隐私 | Advertising、Privacy、Hijacking | `广告拦截` |
| Apple 服务 | Apple 域名与服务 | `苹果服务` |
| 国内应用 | 视频、社交、电商、出行、音乐、资讯、金融、工具、游戏与大厂生态 | `国内流量` |
| AI 与开发 | OpenAI、Claude、Gemini、GitHub、Developer | `AI服务` |
| 特定服务 | Telegram、YouTube、Netflix | 同名策略组 |
| 国际流量 | Global 与 RuleGo Proxy 规则 | `国外流量` |
| 国内 IP 兜底 | 中国 ASN | `国内流量` |

分流主体来自 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)，另有 ACL4SSR、ConnersHua 与 VirgilClyne 等项目的补充规则。公开版没有 VPN 信息，因此这些策略当前均可安全回退为直连。

## 6️⃣ 使用提醒

- 更新配置后先更新远程资源，再重连 Quantumult X 并重启目标 App。
- 同一接口不要同时加载多个响应重写，否则可能重复修改或互相覆盖。
- 出现登录、图片、支付、评论或页面异常时，先单独关闭最近启用的模块。
- MitM 可能触发证书固定或兼容问题；不要共享自己的 CA、口令或证书容器。
- 素材被拒绝后仍可能留下文字卡片或空白占位，这不等于规则没有生效。
- 会员与功能增强模块不属于自研模块，请自行判断服务条款、地区规则和账户风险。
- 分享时请保留仓库链接与原作者署名，不要重新打包转载上游规则文件。

## 7️⃣ 验证、证据与隐私

### 已公开的证据边界

- 美团单车结算响应在两个嵌套分组中明确出现微信弹窗与视频广告项，因此只扩展对应精确接口和广告容器。
- 小红书样本包含 12 次首页响应、116 个信息流条目，其中 1 个带完整广告结构。
- 美团 App 样本的 56 次素材请求中，6 次位于 `/adunion/`，对应 4 个广告创意；其他约 50 次正常素材证明整域封禁会产生误伤。
- 空响应、未知 JSON、埋点、会员、支付、消息、HTTPDNS 与风控请求不会自动被认定为广告。

### 自动化检查

```bash
npm test
npm run scan:secrets
```

测试覆盖广告对象删除、正常内容保留、精确 URL 与路径、重复执行、异常放行，以及公开配置中的空节点段、直连回退、会员模块保留和敏感信息禁入。仓库还会扫描完整 Git 历史，避免通过“提交后再删除”隐藏凭据。

### 不会公开的内容

- 代理节点、订阅地址、用户名、密码、UUID 与认证令牌。
- CA 口令、证书容器、私钥和设备描述文件。
- 网络活动导出、HAR、PCAP、真实请求头与响应正文。
- 账户、设备、订单、会话、位置与其他个人标识。

详细安全边界见 [`SECURITY.md`](SECURITY.md)。

## 8️⃣ 特别感谢

特别感谢以下作者与项目长期公开维护 Quantumult X 规则、脚本、图标和工具，排名不分先后：

[@blackmatrix7](https://github.com/blackmatrix7) · [@ddgksf2013](https://github.com/ddgksf2013) · [@KOP-XIAO](https://github.com/KOP-XIAO) · [@app2smile](https://github.com/app2smile) · [@DivineEngine](https://github.com/DivineEngine) · [@Maasea](https://github.com/Maasea) · [@VirgilClyne](https://github.com/VirgilClyne) · [@NobyDa](https://github.com/NobyDa) · [@ZenmoFeiShi](https://github.com/ZenmoFeiShi) · [@limbopro](https://github.com/limbopro) · [@NSRingo](https://github.com/NSRingo) · [@Chavyleung](https://github.com/chavyleung) · [@Koolson](https://github.com/Koolson) · [@Orz-3](https://github.com/Orz-3) · [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) · [ConnersHua](https://github.com/ConnersHua) · [zZPiglet](https://github.com/zZPiglet)

完整的资源来源、引用边界和维护者说明见 [`THIRD_PARTY.md`](THIRD_PARTY.md)。如有署名遗漏或归属变化，欢迎提交 Issue 指正。

本项目与 Quantumult X、上述作者及相关服务没有隶属或官方合作关系。
