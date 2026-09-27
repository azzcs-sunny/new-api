# 导出到 CC Switch

下载：[CC Switch](https://ccswitch.io/)

## 操作步骤

<p style="color: red;"><strong>注意：</strong>如果想使用 Codex 调用 Claude、Grok 等模型，请选择导出 <strong>Codex</strong>，不要选择 Claude 或 Grok；模型填写对应的模型名称，例如 <code>grok4.7</code> 或 <code>claude-opus-5.5</code>。</p>

1. 登录 WC AI，进入 **API 密钥**页面。
2. 创建或者找到要使用的 API Key，点击右侧操作菜单。
3. 选择 **CC Switch**。
4. 选择应用：Claude、Codex、Gemini 或 Grok。
5. 填写配置名称，并选择或输入 **Primary Model**。
6. 点击 **Open CC Switch**，在 CC Switch 中确认并保存。

<p style="color: red;"><strong>安全提示：</strong>导入链接中包含 API Key，请勿转发、截图或发布到公开地方。</p>

## 常见问题

- **点击后没有打开 CC Switch**：确认已安装 CC Switch，并允许浏览器打开 `ccswitch://` 链接。
- **401 / 403**：检查 API Key 是否有效，以及账号是否有模型权限。
- **404**：检查 API 地址，Codex 和 Grok 需要带 `/v1`。
- **模型不可用**：确认模型名称与 new-api 中的渠道配置一致。
