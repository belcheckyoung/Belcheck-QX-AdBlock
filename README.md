# Belcheck QX AdBlock

一套基于真实流量验证、尽量低误伤的 Quantumult X 广告屏蔽策略。目前重点处理美团单车微信小程序中的微信原生广告组件。

仓库只包含广告规则、响应改写脚本、人工合成测试数据和文档。完整 Quantumult X 配置、代理节点、订阅、证书、网络活动导出及真实抓包不会进入仓库。

## 工作方式

策略分为两层：

1. **组件层**：精确改写美团单车两个 JSON 接口，删除腾讯微信广告项及 Hermes 返回的非 `MOBIKE` 广告策略项，保留骑行数据与 `MOBIKE` 自营内容。
2. **素材层**：拒绝本次验证到的微信广告图片与视频素材域，作为缓存或接口变化时的兜底。

不会拦截微信 MMTLS 公共承载域，也不会封禁整个 `qq.com`、`wxs.qq.com` 或 `bike.meituan.com`。

## Quantumult X 安装

在主配置的 `[rewrite_remote]` 中加入：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Rewrite/MeituanBikeWeChatAds.snippet, tag=美团单车微信广告清理, update-interval=86400, opt-parser=false, enabled=true
```

在 `[filter_remote]` 中加入素材兜底：

```ini
https://raw.githubusercontent.com/belcheckyoung/Belcheck-QX-AdBlock/main/Filters/WeChatMiniProgramAds.list, tag=微信小程序广告素材, force-policy=reject, update-interval=86400, opt-parser=false, enabled=true
```

随后确认：

- Quantumult X 的 Rewrite 与 MitM 已启用。
- Quantumult X CA 已在设备上安装并完全信任。
- 更新远程资源后，重连 Quantumult X，并彻底关闭再打开微信。

若遇到其他小程序图片或视频异常，可先停用素材 Filter，只保留组件层 Rewrite 进行排查。

## 文件结构

- `Scripts/MeituanBikeWeChatAds.js`：响应过滤实现，异常时原样放行。
- `Rewrite/MeituanBikeWeChatAds.snippet`：可由 `[rewrite_remote]` 直接加载的模块。
- `Filters/WeChatMiniProgramAds.list`：已验证素材域兜底规则。
- `Tests/`：完全人工合成、无真实用户数据的回归测试。
- `Tools/secret-scan.sh`：提交文件白名单、当前文件与完整 Git 历史的敏感内容检查。

## 验证

仓库测试无第三方依赖：

```bash
npm test
npm run scan:secrets
```

测试确认：目标广告项会被删除，正常内容保持不变，脚本可重复执行，错误 JSON 会原样放行。

## 已知限制

- 小程序页面可能缓存旧响应或沿用既有连接，更新规则后需要重启隧道和微信。
- 素材域规则是域名级兜底，无法按 URL 路径细分；出现兼容问题时应优先停用该 Filter。
- `main` 分支 Raw 地址会随仓库更新。需要固定行为时，可将 URL 中的 `main` 替换为已审计的 Release 标签或完整提交哈希。

## 隐私与安全

请勿在 Issue、Pull Request 或测试数据中上传完整配置、网络活动导出、真实请求头、真实响应、账户标识、精确位置或证书材料。详见 [SECURITY.md](SECURITY.md)。
