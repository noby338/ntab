# Privacy Policy for NTab

*Last updated: March 2025*

**NTab** ("we", "our", or "the extension") is an open-source, minimalist new tab page with smart multi-column bookmark management. We believe privacy is a fundamental human right. NTab is built with a **100% offline-first, zero-telemetry architecture**.

---

## 1. Zero Data Collection & Tracking

- **No Personal Data Collected**: We do not collect, track, log, or sell any personal data, search queries, browsing habits, IP addresses, or device identifiers.
- **No Analytics / No Tracking Pixels**: NTab contains zero tracking SDKs, zero analytics code (no Google Analytics, Mixpanel, etc.), and zero third-party advertising networks.
- **100% Client-Side Execution**: All layouts, themes, calculations, and bookmark operations run entirely within your local browser sandbox.

---

## 2. Browser Permissions and Why We Need Them

To deliver its core features, NTab requests the following browser permissions. Here is exactly how each is used:

| Permission | Purpose | Where Data Goes |
| :--- | :--- | :--- |
| `bookmarks` | Reads and organizes your local bookmarks into multi-column cards, and executes user actions (add, move, rename, delete). | **100% Local**. Bookmarks never leave your computer. |
| `storage` | Saves your local settings (theme, column width, font size, custom search engines, 7-day trash bin). | Stored in Chrome's native `chrome.storage.sync` / `localStorage`. |
| `topSites` | Displays your most frequently visited sites in the "Top Sites" card. | Read locally via Chrome API. Never sent anywhere. |
| `sessions` | Displays recently closed tabs in the "Recently Closed" card so you can restore them. | Read locally via Chrome API. Never sent anywhere. |
| `favicon` | Fetches site icons for your bookmarks via Chrome's native favicon provider. | Handled internally by Chrome. |
| `identity` | *(Optional)* Used only when you explicitly click "Sign in with Google" to backup your layout config to your own Google Drive (`appDataFolder`). | Sent directly to Google's official OAuth and Drive APIs. No intermediate server exists. |
| `host_permissions` (`*://*/*`) | Used exclusively for the client-side **Bookmark Health Checker**. Performs lightweight `HEAD` requests to verify if your bookmarked URLs return `404` or `403` status codes. | Direct peer-to-target request from your browser. Zero logs or payloads are collected. |

---

## 3. Data Storage & Security

- **Local Storage**: All your customization data (colors, column widths, hotkey bindings, trash bin items) resides strictly in your browser.
- **Cloud Backup**: If you choose to enable Google Drive sync, your settings JSON is stored directly in your own private Google Drive AppData folder. The developers of NTab have **zero access** to your Google account, Drive files, or backups.

---

## 4. Third-Party Websites & External Links

When you click on a bookmark or search using a search engine (e.g., Google, DuckDuckGo, Bing, Baidu), you navigate to third-party websites that operate under their own independent privacy policies.

---

## 5. Open Source Transparency

NTab is open-source software under the MIT License. The complete source code is publicly inspectable and verifiable on GitHub:  
👉 [https://github.com/noby338/ntab](https://github.com/noby338/ntab)

---

## 6. Contact & Inquiries

If you have any questions or feedback regarding this Privacy Policy, please open an issue or reach out via GitHub:  
- **Repository**: [https://github.com/noby338/ntab/issues](https://github.com/noby338/ntab/issues)

---

# NTab 隐私权政策（中文版）

*更新日期：2025 年 3 月*

**NTab**（以下简称“我们”或“本扩展”）是一款现代化、极简主义的多列书签管理新标签页扩展。我们坚信隐私是每个人的基本权利。NTab 采用 **100% 离线优先、零数据收集（Zero-Telemetry）** 的安全架构。

---

## 1. 零数据收集与零追踪

- **不收集任何个人数据**：我们不收集、不记录、不上传、也不出售您的任何个人身份信息、搜索关键词、浏览历史或设备标识。
- **无任何第三方分析追踪代码**：NTab 没有任何分析 SDK（如 Google Analytics、百度统计等），不包含任何广告网络或追踪像素。
- **纯本地运行**：所有的排版计算、主题切换与书签管理均在您的浏览器本地沙箱中执行。

---

## 2. 权限使用说明（公开透明）

为了实现必要的功能，NTab 申请了以下浏览器权限：

| 权限名称 | 用途说明 | 数据流向 |
| :--- | :--- | :--- |
| `bookmarks` | 读取您的书签树并渲染为自适应多列卡片，执行新建、重命名、拖拽排序与删除。 | **完全本地**，绝不上传至任何外部服务器。 |
| `storage` | 保存您的排版喜好（列宽、字体大小、间距、搜索引擎、7天防误删回收站）。 | 存储在浏览器的原生 `chrome.storage.sync` 或 `localStorage`。 |
| `topSites` | 读取浏览器常访网站并展示在“常访网站”小卡片中。 | 仅由浏览器原生接口本地提供。 |
| `sessions` | 读取最近关闭的分页并在卡片中展示，方便快速重新打开。 | 仅由浏览器原生接口本地提供。 |
| `favicon` | 通过 Chrome 原生图标服务展示书签的高清网站图标。 | 由浏览器内核内部处理。 |
| `identity` | *(可选)* 仅在您主动点击“Google 账号登录”时，调用官方接口将排版备份至您个人的 Google Drive 私有应用目录。 | 直连 Google 官方接口，开发者无权访问您的账号和数据。 |
| `host_permissions` (`*://*/*`) | 仅用于客户端**书签失效检测**功能。向您收藏的网址发起轻量探测，判断是否返回 404 或 403 状态。 | 仅由浏览器直接请求目标网站，不传输任何个人数据，无任何日志记录。 |

---

## 3. 开源透明

NTab 为基于 MIT 协议的开源软件，完整代码公开透明，欢迎任何开发者检阅与监督：  
👉 [https://github.com/noby338/ntab](https://github.com/noby338/ntab)
