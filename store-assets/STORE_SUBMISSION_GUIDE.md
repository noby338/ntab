# NTab - Chrome Web Store & Edge Add-ons 最终上架提交指南

本指南为您整理了在 **Chrome Web Store 开发者后台** 与 **Edge 扩展中心** 提交审核时所需填写的全部物料、中英文文案以及**权限审核申辩词（Permission Justifications）**。直接复制粘贴即可。

---

## 1. 提交文件与图片物料清单

| 物料类型 | 本地文件路径 | 规格尺寸 | 强制性 |
| :--- | :--- | :--- | :--- |
| **扩展安装包** | `.output/ntab-1.0.0-chrome.zip` | 539 KB (极简轻量) | **必须** |
| **应用图标** | `public/icon/128.png` | 128 $\times$ 128 PNG | **必须** |
| **小尺寸宣传图** | `store-assets/promo-440x280.png` | 440 $\times$ 280 PNG | **必须** |
| **主屏幕截图 1 (全景)** | `store-assets/screenshot-1-1280x800.png` | 1280 $\times$ 800 PNG | **必须** (至少1张) |
| **主屏幕截图 2 (细节)** | `store-assets/screenshot-2-1280x800.png` | 1280 $\times$ 800 PNG | 建议提供 |
| **原始备份截图** | `store-assets/raw/` | 原始高清图 | 本地存档备用 |

---

## 2. 核心合规设置：权限申辩文案 (Permission Justifications)

> ⚠️ **审核重点**：由于插件申请了 `*://*/*` 和 `bookmarks`，Chrome Web Store 人工审核团队要求对每项权限提供合理解释。请将以下经过验证的专业英文直接粘贴到后台对应的输入框中：

### Single Purpose Description (单一用途描述)
```text
A modern, minimalist new tab dashboard that organizes browser bookmarks into responsive, customizable multi-column cards with instant search and dead-link health checking.
```

### Permission Justification for `host_permissions` (`*://*/*`)
```text
The `<all_urls>` host permission is used strictly on the client side for the "Bookmark Health Checker" feature. It sends lightweight HEAD/GET requests directly from the user's browser to check whether their bookmarked URLs return 404 Not Found or 403 Forbidden errors. No user data, payloads, or browsing history are ever collected, logged, or transmitted to any external server.
```

### Permission Justification for `bookmarks`
```text
Used to read the user's local bookmark hierarchy to display them as multi-column cards on the new tab page, and to allow the user to organize, add, rename, move, and delete bookmarks locally.
```

### Permission Justification for `storage`
```text
Used to store local user customization preferences (theme selection, custom column percentage widths, font sizes, keyboard shortcut bindings, and the local 7-day trash bin).
```

### Permission Justification for `topSites` and `sessions`
```text
Used locally to render the optional "Top Sites" and "Recently Closed Tabs" widgets so users can quickly revisit their favorite or recently closed pages.
```

### Permission Justification for `identity`
```text
Used solely when the user explicitly clicks "Sign in with Google" to backup and restore their NTab layout configuration JSON file directly to their own private Google Drive (appDataFolder).
```

---

## 3. 隐私权政策 (Privacy Policy)

- **隐私政策网址 (Privacy Policy URL)** 选项填写：
  - 独立网页部署地址：`https://noby338.github.io/ntab/privacy.html`（或您的自定义部署 URL，如 `https://ntab.vercel.app/privacy.html`）

---

## 4. 商店双语展示文案 (Store Listing Copy)

### 英文版 (English - 建议作为默认主语言)

**Title (扩展名称, <= 45 chars)**:
```text
NTab - Minimalist New Tab & Bookmark Manager
```

**Summary (一句话简介, <= 132 chars)**:
```text
Fast, modern, and minimalist new tab page with customizable multi-column bookmarks, 7-day trash bin, and dead link checker. Zero ads.
```

**Description (详细描述)**:
```markdown
Transform your browser's new tab into a clean, modern, and hyper-efficient productivity canvas.

NTab is an open-source, minimalist new tab extension designed for developers, designers, and web power users. It displays your bookmarks as clean, customizable multi-column cards that adapt seamlessly from ultra-wide screens to compact split-screen mode.

✦ KEY FEATURES

1. Responsive Multi-Column Layout
- Adjust column width with percentage presets (10% to 100%) or fine-tune with a continuous slider.
- Perfect side-by-side split screen view with zero clipped cards.
- Intuitive drag-and-drop to reorder cards, nest folders, or move bookmarks.

2. Smooth Batch Management & Selection
- Fluid vector-interpolated drag selection to select dozens of bookmarks effortlessly.
- Batch move or batch delete in one click.

3. 7-Day Safety Trash Bin (Recently Deleted)
- Accidental deletions are saved locally in a 7-day trash bin.
- Instant one-click restore for bookmarks and entire folders.

4. Lightweight Dead Link Health Checker
- Probes your bookmarked URLs using minimal HEAD requests.
- Quickly identifies 404 broken pages and 403 access barriers so you can clean up obsolete links.

5. Global Multi-Search & AI Fast Switch
- Built-in instant switching across Google, Bing, DuckDuckGo, Baidu, and GitHub.
- Supports AI prompts (ChatGPT, Gemini, DeepSeek, Perplexity).
- Press number keys 1~9 to switch search engines instantly.

6. 100% Privacy & Zero Telemetry
- No tracking, no analytics SDKs, and zero advertising.
- Fully operational offline without any forced account registration.
- Optional private Google Drive backup directly to your personal Drive.

Open-source on GitHub: https://github.com/noby338/ntab
MIT License.
```

---

### 中文版 (Simplified Chinese)

**Title (扩展名称)**:
```text
NTab - 极简新标签页与多列书签管理
```

**Summary (一句话简介)**:
```text
轻快现代的自适应多列书签起始页。自带7天防误删回收站、死链体检、平滑批量多选与秒级搜索，零广告纯净开源。
```

**Description (详细描述)**:
```markdown
每一次打开新标签页，都应该是清晰、从容且高效的开始。

NTab 是一款专为开发者、设计师与数字生活爱好者打造的开源极简新标签页扩展。它将杂乱无章的书签栏重构为像精美杂志排版一样的自适应多列卡片，无论是带鱼大屏还是左右半屏分屏，都能严丝合缝紧凑平铺。

✦ 核心功能特色

1. 自适应百分比多列排版
- 支持 10% 到 100% 自由百分比列宽微调，贴合各种分屏与屏幕分辨率。
- 无论开几个分列，屏幕两端零多余留白、不挤压、不截断。
- 支持上下、左右分列自由拖拽排序与卡片独立拆分。

2. 平滑滑动批量多选
- 独创向量线性插值采样算法，鼠标在书签列表上快速划过即可瞬时成批勾选。
- 支持一键批量移动至任意目录或一键批量清理。

3. 7天防手滑本地回收站
- 误删书签不再恐慌！所有删除操作自动转入 7 天本地回收站。
- 支持一键满血恢复原始位置，或永久彻底删除。

4. 超轻量书签失效体检
- 采用超轻量 HEAD 探测技术，零流量浪费。
- 精准标记 404 网页丢失与 403 权限拦截，方便批量筛查并清理多年沉淀的失效死链。

5. 全局秒级搜索与 AI 聚合快捷切换
- 支持 Google、必应、百度、DuckDuckGo、GitHub 等主流搜索。
- 支持 ChatGPT、Gemini、DeepSeek、Perplexity 等 AI 快捷提问。
- 键盘按数字键 1~9 即可实现搜索引擎全局毫秒级轮换。

6. 极致隐私，零数据收集
- 零分析代码、零用户追踪、零广告插件。
- 100% 本地离线优先架构，无需强制注册或登录即可完整使用。
- 仅提供直连 Google Drive 的个人私有云备份选项。

GitHub 开源仓库：https://github.com/noby338/ntab
开源许可：MIT License
```

---

## 5. 常见分类选择 (Category)

- **分类 (Category)**: `Productivity` (生产力工具) / `Workflow & Planning` (工作流与规划)
- **定价**: `Free` (完全免费)
