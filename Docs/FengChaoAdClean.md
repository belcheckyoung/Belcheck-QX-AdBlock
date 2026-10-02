# 丰巢小程序广告与推广净化

本模块清理用户网络记录中确认的丰巢广告与会员推广，并预拦截上游明确标为广告的 RTM 专用接口。开屏广告没有出现在本次记录中：若它使用同一广告下发接口，本模块覆盖该广告位；若走其他接口或微信内部加密流量，需要补充记录才能定位。不能承诺已彻底消除所有开屏。

## 安装

已有自己的 Quantumult X 配置时，在 `[rewrite_remote]` 最前面添加下面这一行，无需替换完整配置：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/FengChaoAdClean.snippet, tag=丰巢小程序广告与推广净化, update-interval=86400, opt-parser=false, enabled=true
```

**检查 `[mitm]` 的现有 hostname 行：如果有 `-*.fcbox.com`，仅移除这一项，保留其他域名和排除项。** 本仓库旧公开配置存在这个排除项；无法据此确认你的手机当前仍有它。模块自身声明所需的具体域名。远程资源里的 hostname 不能覆盖显式排除。

确认重写和 MitM 已开启、现有 CA 已安装并受信任；更新本模块，再重连 Quantumult X，关闭并重新打开丰巢小程序。之前下载的素材或页面状态可能仍被微信缓存。

同一接口若已经命中其他模块的整域拒绝规则，请关闭冲突规则或调整顺序，使本模块响应清理规则先命中；否则无广告成功响应和广告开关不会生效。不要关闭全部原有广告模块。

## 处理范围

| 接口或内容 | 处理 | 证据 |
| --- | --- | --- |
| `dsp.fcbox.com/adSearch/get`、`getMulti` | 不限制广告位编号，保持成功外壳，将广告数据清为 `null`；关闭已存在的三个广告开关 | 记录 95、100、116；单条及多广告位接口均出现过自然 `data:null` |
| `webchatapp.fcbox.com/commerce/mobile/appConfig/getPositions` | 删除已识别的订单列表第三帧和带 `adunit-` 的微信广告配置，保留其他配置 | 记录 121 |
| `webchatapp.fcbox.com/fcboxactivityweb/api/v2/clientPage/getUserClientPageInfo` | 关闭已识别的“会员直降”中间导航，保留其他页面配置 | 记录 78、83、82、93 |
| `webchatapp.fcbox.com/post/suggestion/query` | 清空已识别的会员推广 `top` 容器及半屏购买入口，保留其他建议位 | 记录 124、137、135 |
| `dsp.fcbox.com/adTracker/stat` | 广告曝光／点击上报返回空 200 | 记录 120、127 |
| `ad-dsp-1251779293.file.myqcloud.com` | 拒绝专用广告素材 | 记录 122，广告响应也引用该主机 |
| 共享 CDN 上的取件会员横条 | 只拒绝记录 137 的精确素材路径 | 记录 137；其他共享 CDN 图片保留 |
| `rtm.fcbox.com/rtsWeb/api/resource/ad/queryAd` | 返回空 JSON 字典，提前拦截专用广告接口 | 上游接口线索；本次未出现，不能当作已验证开屏接口 |

`wxAdsFlag`、`fcDspFlag`、`interstitialErrSwitch` 在记录里是字符串。本模块将已存在的 `"true"` 改为 `"false"`，不补造缺失字段；布尔类型变体也保持原类型。依据字段名推断它们控制微信广告、丰巢广告和插屏异常处理，具体前端行为没有文档或设备验证。

本模块不改会员状态，不解锁付费权益，不处理取件码、订单、寄件、登录或支付主接口。广告专用的会员推广容器中同时存在超时件展示开关，移除容器后的超时取件列表行为必须复测。未知结构、错误响应和其他正常内容原样放行。

## 开屏覆盖边界

- 已观察的三个广告位均被覆盖，未来用 `get/getMulti` 的其他广告位也进入同一清理规则。
- 已识别的微信广告下发开关和程序化广告位一起处理，尝试减少缺少丰巢素材后回退到微信广告的情况。
- RTM 规则属于精确的上游预防规则。未加入来源不明的 `queryInset` 接口，也未屏蔽微信通用网络域名。
- 上游另有 `consumer.fcbox.com/vN/ad/` 和历史 `external.fcbox.com` 线索，未在本次记录出现，且前者有无法 MitM 的上游备注。本版本没有据此扩大到 App 或历史域名。

## 验证与回退

公开测试均为人工合成数据；真实记录只在本机回放，不提交原始记录、凭据或截图。自动检查涵盖成功空广告结构、字符串开关、普通配置保留、异常放行、重复执行和 Quantumult X 脚本入口。结构回放不等于手机界面验收。

手机上复测：冷启动开屏、订单列表 Banner、取件页会员横条及空白占位、“会员直降”入口、正常和超时取件、寄件、登录与支付。若仍有广告，保存新一轮网络记录；若出现页面异常，单独关闭这个模块再复测。

## 接口线索与官方语法

- [Quantumult X 官方重写文档](https://github.com/crossutility/Quantumult-X/blob/master/rewrite.md)
- [Quantumult X 官方配置样例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)
- [fmz200 丰巢广告接口线索](https://github.com/fmz200/wool_scripts/blob/main/Loon/plugin/blockAds.plugin)
- [blackmatrix7 Quantumult X 广告规则](https://github.com/blackmatrix7/ios_rule_script/blob/master/rewrite/QuantumultX/AllInOne/AllInOne.conf)

响应清理代码依据本次实际结构独立实现；上游只用于确认补充广告接口线索。感谢上游维护者。
