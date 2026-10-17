# 第三方资源与致谢

这份公开配置的价值建立在许多作者长期维护的规则、脚本、图标与工具之上。谢谢所有公开分享、持续修复并保留清晰署名的作者。

## 核心参考项目

- [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)：提供 Quantumult X 广告、隐私、反劫持、应用分流、AI 服务与流媒体等规则。本项目仅引用其官方 Raw 地址，不复制或重新发布其规则文件；使用条件与免责声明以原项目为准。
- [ddgksf2013](https://github.com/ddgksf2013)：提供墨鱼系列广告净化、开屏处理、网页优化、功能增强和可选会员模块。配置保留原始链接、作者来源和可独立启停结构；使用条件以对应资源内的作者说明为准。

## 其他直接引用的作者与项目

- [KOP-XIAO/QuantumultX](https://github.com/KOP-XIAO/QuantumultX)：资源解析器与流媒体查询工具。
- [bin64/Scripts](https://github.com/bin64/Scripts)：VVebo 请求与响应重写。
- [app2smile/rules](https://github.com/app2smile/rules)：Spotify 可选模块。
- [DivineEngine](https://github.com/DivineEngine)、[Maasea](https://github.com/Maasea)、[app2smile](https://github.com/app2smile) 与 [VirgilClyne](https://github.com/VirgilClyne)：当前 YouTube 广告处理资源头信息列出的原始作者。
- [ZenmoFeiShi/Qx](https://github.com/ZenmoFeiShi/Qx)：滴滴可选重写与分流。
- [limbopro/Adblock4limbo](https://github.com/limbopro/Adblock4limbo)：网页净化模块。
- [NobyDa/Script](https://github.com/NobyDa/Script)：Google CAPTCHA 兼容模块。
- [zZPiglet](https://github.com/zZPiglet)：微信 URL 解锁功能的原作者。
- [NSRingo](https://github.com/NSRingo)：Apple 定位服务与 WeatherKit 可选增强。
- [ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)：微信分流补充。
- [ConnersHua/RuleGo](https://github.com/ConnersHua/RuleGo)：全球加速规则。
- [VirgilClyne/GetSomeFries](https://github.com/VirgilClyne/GetSomeFries)：中国 ASN 规则。
- [chavyleung/scripts](https://github.com/chavyleung/scripts)：BoxJS 后端。
- [Koolson/Qure](https://github.com/Koolson/Qure) 与 [Orz-3/mini](https://github.com/Orz-3/mini)：策略与模块图标。

这些资源由 Quantumult X 在使用时从上游地址获取，不作为本仓库代码重新打包。第三方资源的许可证、署名要求、免责声明、功能边界和更新节奏均由各自作者决定。本项目与 Quantumult X、上述作者及相关服务没有隶属或官方合作关系。

## 菜鸟净化的接口线索

`Scripts/CaiNiaoUIClean.js` 的早期接口定位参考 [ddgksf2013/Scripts/cainiao_json.js](https://github.com/ddgksf2013/Scripts/blob/master/cainiao_json.js)。本模块依据用户提供的实际响应重新实现结构识别、保留条件与本地测试，感谢上游提供线索。

## 丰巢广告的接口线索

丰巢响应清理依据本次网络记录独立实现。补充 RTM 专用广告路径的定位参考 [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts/blob/main/Loon/plugin/blockAds.plugin)；丰巢 DSP 域名及页面配置线索也参考 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/blob/master/rewrite/QuantumultX/AllInOne/AllInOne.conf)。未将上游整个文件复制或改名发布。感谢上游维护者。

## 哔哩哔哩 App 广告补丁

广告结构依据本次网络记录独立识别，二进制回传遵循 [Quantumult X 官方示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-bytes-rewrite.js) 和 [gRPC 协议](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md)。`Scripts/BilibiliAppAds.js` 内嵌 [fflate 0.8.3](https://github.com/101arrowz/fflate) UMD 发布代码处理 gzip，作者 Arjun Barrett，MIT 许可证完整保留在脚本头部。未复制第三方广告脚本。

## 抖音广告的字段线索

抖音实验模块的 `aweme_list / is_ads` 历史结构线索参考 [Choler/Surge 的 douyin.js](https://github.com/Choler/Surge/blob/master/Script/douyin.js)。字段字符串与广告接口另从用户提供的 iOS 30.3.0 安装包静态确认；尚未取得对应实际响应。原文切片、精确域名边界、异常放行及测试独立实现，没有复制上游脚本，也没有引入其下载、水印和直播处理。感谢原作者提供线索。
