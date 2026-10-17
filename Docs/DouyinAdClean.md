# 抖音广告清理（实验）

模块版本 **0.1.0（2026-10-18）**。依据用户提供的抖音 iOS **30.3.0 / 303008** 安装包读取广告路径、默认 API 分发配置及广告字段，独立实现 Quantumult X 规则和信息流过滤脚本。

**当前证据是 IPA 静态分析与人工合成测试，尚无实际广告响应或手机效果验收。** 可以安装试用；这不构成所有版本、所有开屏或所有信息流广告均有效的承诺。用户手机上的抖音版本尚不确定。

## 安装到已有配置

1. 备份手机上正在使用的配置。在其 `[rewrite_remote]` 区段最前面加入以下一行；已添加过时更新原条目即可：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/DouyinAdClean.snippet, tag=抖音广告清理-实验, update-interval=86400, opt-parser=false, enabled=true
```

2. 检查 `[mitm]` 的 `hostname` 行。**若存在 `-*amemv.com`、`-*snssdk.com`，仅移除这两项，保留其他域名与排除项。** 本仓库完整公开配置保留这两项默认排除，所以只把模块开关改成 `true` 还不够。模块自身已声明五个具体主机；远程声明不能覆盖本地显式排除。若还有直接排除这五个主机的条目，也需先处理对应冲突。
3. 确认 Quantumult X 的 Rewrite 与 MitM 已开启，自己的 CA 已安装并在 iOS 中完全信任。
4. 更新此远程重写资源，确认状态正常；重新连接 Quantumult X，彻底关闭抖音后重新打开，再检查开屏与推荐流。

完整公开配置中的这个模块默认为 `enabled=false`，供用户单独选择。已有个人配置时使用上面的增量安装行即可。

移除上述两项会解除这两类域名的本地解密排除；最终解密范围还取决于其他已启用资源声明的主机。本模块仅声明下列五个具体主机。

同一推荐接口若已经由其他模块拒绝或改写，先停用对应冲突规则或调整顺序，让本模块先匹配；保留其他应用的规则。已缓存的广告素材仍可能继续展示。

## 覆盖范围与证据

| 范围 | 行为 | 证据强度 |
| --- | --- | --- |
| `ad.zijieapi.com/api/ad/v1/slot/`、`long/video/`、`recall_ads/banner/` | 拒绝这些精确广告请求 | 完整 URL 在二进制解压字符串中出现；未捕获运行时调用 |
| 下列四个 API 主机上的五类开屏路径 | 拒绝专用广告路径 | 路径在二进制或默认配置中出现；这些主机与开屏请求的配对属于预防性覆盖 |
| 同四个主机的 `/aweme/v1/feed`、`/aweme/v2/feed` | 仅删除顶层 `aweme_list` 内明确 `is_ads` 广告条目 | 默认网络配置将推荐接口分发到 `api3-core-c.amemv.com`，另有原始 API 与 normal-c 映射；字段字符串已确认，实际响应结构及类型尚待验证 |

四个 API 主机为：`api3-core-c.amemv.com`、`api3-normal-c.amemv.com`、`api.amemv.com`、`aweme.snssdk.com`。未将它们扩展为整个 `*.amemv.com` 或 `*.snssdk.com` 的 MitM 通配。

QX 根据请求的域名和路径匹配规则，不能仅凭本模块标题识别发起请求的 App。其他 App 若访问相同的 `ad.zijieapi.com` 广告地址，也会被本模块拒绝。

开屏候选路径限定为：

```text
/api/ad/v1/splash/stock
/api/ad/v16/splash/preload
/api/ad/splash/stock/realtime/v14
/api/ad/splash/stock/realtime/v15
/api/ad/splash/aweme/v15
```

规则允许 HTTP/HTTPS、查询参数和可选的结尾斜杠，精确路径之外保持原有处理。部分包内限时网络规则的日期为 2021 年；默认配置不能视为今天手机上的实际分发配置。其他地区 API 域名或未来接口暂不自动加入。

## 信息流过滤方式

仅在指定推荐接口的可读 JSON 中识别顶层 `aweme_list`。只移除直接条目中明确标记 `is_ads` 为布尔 `true` 或数值 `1` 的对象；不会根据空 `raw_ad_data`、商业音乐、直播或普通商品信息猜测广告。

脚本通过原始 JSON 文本切片删除条目，保留剩余条目与外层响应的原始文本，避免重新序列化 64 位数字 ID、视频地址、下载、水印和分页字段。错误、未知结构及无法读取的响应原样放行。脚本没有通知、联网、持久化存储或正文日志。

`aweme_list / is_ads` 的历史结构线索参考 [Choler 原作者脚本](https://github.com/Choler/Surge/blob/master/Script/douyin.js)。这里独立实现广告过滤，没有引入其下载、水印和直播处理。

## 验证与排查

仓库测试验证广告条目过滤、正常视频与直播保留、原始数字及分页保留、异常放行、重复执行、精确域名和路径边界、远程资源格式以及 QX `$done` 入口。公开样本全部人工合成。测试通过不代表实际响应可解密或手机广告已消失。

安装后分别检查：冷启动开屏、推荐流广告、普通视频连续播放、翻页、直播条目和界面占位。若出现视频加载或其他页面异常，单独关闭“抖音广告清理-实验”并重连，再复测。

若广告仍在，用 QX HTTP Analyzer 记录一次“重新启动抖音 → 刷到广告”，仅导出抖音相关记录并包含响应正文，供私下分析。真实请求记录、原 IPA、提取数据和账户资料不提交到公开库。

App 是否接受 QX 证书、是否采用 QUIC、Protobuf 或应用层加密都需要运行时证据。QX 支持文本和二进制正文改写，但无法凭包内 `cryptid=0` 推断网络明文可读。本模块没有新增全局 QUIC 设置，也没有改动登录、支付、HTTPDNS 或共享视频 CDN 的规则。

## 回退与更新

在 QX 远程重写资源中关闭本模块，或将该订阅行改为 `enabled=false`，然后重连 QX 并重启抖音。若本次启用时删除了原有排除项，可按自己的配置备份恢复对应条目。

日常更新此远程重写资源即可，不用手动保存 JS。模块中的脚本地址会固定到经仓库测试的提交，升级时随模块一起更新。

## 来源

- [Quantumult X 官方重写文档](https://github.com/crossutility/Quantumult-X/blob/master/rewrite.md)
- [Quantumult X 官方配置样例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)
- [Quantumult X 官方正文改写示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-rewrite-with-script.js)
- [Quantumult X 官方字节改写示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-bytes-rewrite.js)
- [Apple 证书固定说明](https://developer.apple.com/news/?id=g9ejcf8y)
- [Choler 原作者抖音脚本](https://github.com/Choler/Surge/blob/master/Script/douyin.js)

本模块的路径、域名分发与字段证据来自指定安装包的只读解析和 LZFSE 数据解压；原包与提取文件保留在本地，不随模块公开。
