# 丰巢小程序广告与推广净化

当前版本 **1.6.0（2026-10-04）**。本模块清理两次网络记录中确认的丰巢广告与会员推广，并预拦截上游明确标为广告的 RTM 专用接口。

10 月 4 日用户反馈看到了开屏广告。本次 560 条记录包含四次冷启动，但可读接口和曝光上报没有提供独立开屏素材的完整链路；首页头图被明确标为“首页-头图”，不能据此称为开屏。本版补齐实际下发的首页会员头图、寄件会员推广、首页广告模块和取件卡营销。若独立开屏走其他接口、缓存或微信内部加密流量，仍需进一步定位，不能承诺已经彻底消除。

## 安装

已有自己的 Quantumult X 配置时，在 `[rewrite_remote]` 最前面添加下面这一行，无需替换完整配置：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/FengChaoAdClean.snippet, tag=丰巢小程序广告与推广净化, update-interval=86400, opt-parser=false, enabled=true
```

**检查 `[mitm]` 的现有 hostname 行：如果有 `-*.fcbox.com`，仅移除这一项，保留其他域名和排除项。** 本仓库旧公开配置存在这个排除项；无法据此确认你的手机当前仍有它。模块自身声明所需的具体域名。远程资源里的 hostname 不能覆盖显式排除。

确认重写和 MitM 已开启、现有 CA 已安装并受信任；更新本模块，再重连 Quantumult X，关闭并重新打开丰巢小程序。之前下载的素材或页面状态可能仍被微信缓存。

**已安装者只需在 Rewrite Resources 中更新现有丰巢资源。** 若仍读取旧缓存，把该资源地址改为以下地址再点 `UPDATE`，无需重复添加：

```text
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/FengChaoAdClean.snippet?v=1.6.0
```

同一接口若已经命中其他模块的整域拒绝规则，请关闭冲突规则或调整顺序，使本模块响应清理规则先命中；否则无广告成功响应和广告开关不会生效。不要关闭全部原有广告模块。

旧版若显示取件推广素材规则 `Invalid Line`，更新本资源。修正版采用纯 ASCII 正则，按同一主机、目录和唯一素材后缀匹配编码／未编码 URL；手机更新是否成功仍需在设备确认。若仍读取旧版，可临时使用当前修复提交的固定版本订阅地址。

## 处理范围

下表旧记录指 2026-10-02 的 209 条记录，新记录指 2026-10-04 的 560 条记录。

| 接口或内容 | 处理 | 证据 |
| --- | --- | --- |
| `dsp.fcbox.com/adSearch/get`、`getMulti` | 不限制广告位编号，保持成功外壳，将广告数据清为 `null`；关闭已存在的三个广告开关 | 旧记录 95、100、116；新记录 12 次响应数据为空、已有开关关闭 |
| `webchatapp.fcbox.com/commerce/mobile/appConfig/getPositions` | 删除已识别的订单列表第三帧和带 `adunit-` 的微信广告配置，保留其他配置 | 旧记录 121；新记录 137、253、377、508 数据为空数组 |
| `webchatapp.fcbox.com/fcboxactivityweb/api/v2/clientPage/getUserClientPageInfo` | 关闭已识别的“会员直降”中间导航，保留其他页面配置 | 旧记录 78；新记录 62、199、322、455 中间导航已关闭 |
| `webchatapp.fcbox.com/post/suggestion/query` | 清空已识别的会员推广 `top` 容器及半屏购买入口，保留其他建议位 | 旧记录 124、137、135 |
| `webchatapp.fcbox.com/fcboxactivityweb/api/v2/clientPage/topImg` | 仅将有图片、跳转到已识别会员页的 `headImg` 设为 `null`，保留配置外壳 | 新记录 70、200、323、456；103 下载“全年畅取快递，我包了”素材；100、249、359、485 上报首页头图曝光 |
| 同目录 `batchQueryClientPageConfigs` | 仅移除带图片及会员跳转的 `type32` 推广节点，保留 `type6.sendIcons` | 新记录 73、210、332、464；保留省钱卡、上门取、退换货、寄件钱包 |
| 同目录 `modulesAggregated` | 仅过滤同时标为 `m2`、`banner模块`、`广告` 的模块 | 新记录 74、209、335、468；保留生活服务、储物服务、其他模块和等级信息 |
| 同目录 `homePickUpCardMarketingAggregated` | 双层 JSON 字符串中，识别会员营销名称和两个会员链接后，关闭已有布尔按钮、徽标、横条展示开关 | 新记录 77、212、337、471；其他取件配置与字段类型保留 |
| `dsp.fcbox.com/adTracker/stat` | 广告曝光／点击上报返回空 200 | 旧记录 120、127 |
| `ad-dsp-1251779293.file.myqcloud.com` | 拒绝专用广告素材 | 旧记录 122，广告响应也引用该主机 |
| 共享 CDN 上的取件会员横条 | 限定旧记录 137 的主机、目录和唯一素材后缀 | 旧记录 137；其他共享 CDN 图片保留 |
| `rtm.fcbox.com/rtsWeb/api/resource/ad/queryAd` | 返回空 JSON 字典，提前拦截专用广告接口 | 上游接口线索；本次未出现，不能当作已验证开屏接口 |

`wxAdsFlag`、`fcDspFlag`、`interstitialErrSwitch` 在记录里是字符串。本模块将已存在的 `"true"` 改为 `"false"`，不补造缺失字段；布尔类型变体也保持原类型。依据字段名推断它们控制微信广告、丰巢广告和插屏异常处理，具体前端行为没有文档或设备验证。

本模块不改会员状态，不解锁付费权益，不处理取件码、订单、寄件、登录或支付主接口。广告专用的会员推广容器中同时存在超时件展示开关，移除容器后的超时取件列表行为必须复测。未知结构、错误响应和其他正常内容原样放行。

新增接口保留 `homePageConfig` 与 `moduleJson` 的 JSON 字符串类型。请求仅调整压缩协商，仍由 Quantumult X 处理响应编码和长度。首页头图清空和推广节点移除后的占位、取件卡三个开关的界面效果，需要在手机确认。

## 开屏覆盖边界

- 已观察的三个广告位均被覆盖，未来用 `get/getMulti` 的其他广告位也进入同一清理规则。
- 已识别的微信广告下发开关和程序化广告位一起处理，尝试减少缺少丰巢素材后回退到微信广告的情况。
- RTM 规则属于精确的上游预防规则。未加入来源不明的 `queryInset` 接口，也未屏蔽微信通用网络域名。
- 新记录的会员等级弹窗接口四次均未弹出；两张微信共享 CDN 图片是渐变遮罩与胶囊形辅助素材，没有广告文案。本版没有据此添加广告规则。
- 上游另有 `consumer.fcbox.com/vN/ad/` 和历史 `external.fcbox.com` 线索，未在本次记录出现，且前者有无法 MitM 的上游备注。本版本没有据此扩大到 App 或历史域名。

## 验证与回退

公开测试均为人工合成数据；真实记录只在本机回放，不提交原始记录、凭据或截图。自动检查涵盖成功空广告结构、字符串开关、普通配置保留、异常放行、重复执行和 Quantumult X 脚本入口。结构回放不等于手机界面验收。

1.6.0 验证结果：丰巢模块 392 项合成检查通过；新记录 560 条中仅改写四个新增接口的 16 条响应，其余 544 条不返回正文修改。旧记录 209 条仍仅改写原有 6 条。两轮均验证仅预期字段改变、重复清理不再修改；新增接口关闭对应选项后原样返回。

手机上复测：冷启动开屏、订单列表 Banner、取件页会员横条及空白占位、“会员直降”入口、正常和超时取件、寄件、登录与支付。若仍有广告，保存新一轮网络记录；若出现页面异常，单独关闭这个模块再复测。

## 接口线索与官方语法

- [Quantumult X 官方重写文档](https://github.com/crossutility/Quantumult-X/blob/master/rewrite.md)
- [Quantumult X 官方配置样例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)
- [fmz200 丰巢广告接口线索](https://github.com/fmz200/wool_scripts/blob/main/Loon/plugin/blockAds.plugin)
- [blackmatrix7 Quantumult X 广告规则](https://github.com/blackmatrix7/ios_rule_script/blob/master/rewrite/QuantumultX/AllInOne/AllInOne.conf)

响应清理代码依据本次实际结构独立实现；上游只用于确认补充广告接口线索。感谢上游维护者。
