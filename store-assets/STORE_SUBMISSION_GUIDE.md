# NTab - Chrome Web Store & Edge Add-ons 最终上架提交指南

本指南整理商店物料与文案。提交前先完成 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)；此文件及历史安装包不代表已通过审核或完成登录、同步验证。

---

## 1. 提交文件与图片物料清单

| 物料类型 | 本地文件路径 | 规格尺寸 | 强制性 |
| :--- | :--- | :--- | :--- |
| **扩展安装包** | `.output/ntab-1.0.5-chrome.zip` | 以本次构建为准 | **必须** |
| **应用图标** | `public/icon/128.png` | 128 $\times$ 128 PNG | **必须** |
| **小尺寸宣传图** | `store-assets/promo-440x280.png` | 440 $\times$ 280 PNG | **必须** |
| **主屏幕截图 1 (全景)** | `store-assets/screenshot-1-1280x800.png` | 1280 $\times$ 800 PNG | **必须** (至少1张) |
| **主屏幕截图 2 (细节)** | `store-assets/screenshot-2-1280x800.png` | 1280 $\times$ 800 PNG | 建议提供 |
| **原始备份截图** | `store-assets/raw/` | 原始高清图 | 本地存档备用 |

---

## 2. 核心合规设置：权限申辩文案 (Permission Justifications)

申请的权限应逐项说明用途，且与实际实现一致。以下为待提交文案，不代表获得审核认可。

### Single Purpose Description (单一用途描述)
```text
A modern, minimalist new tab dashboard that organizes browser bookmarks into responsive, customizable multi-column cards with instant search and dead-link health checking.
```

### Permission Justification for `host_permissions` (`*://*/*`)
```text
HTTP and HTTPS host access allows the optional Bookmark Health Checker to send HEAD or fallback GET requests directly to bookmarked URLs. Destination websites receive normal request information, including the requested URL and network address. Host access also permits direct connections to Google APIs for optional account sign-in and configuration backup. NTab does not proxy these requests through a developer-operated server.
```

### Permission Justification for `bookmarks`
```text
Used to read the user's local bookmark hierarchy to display them as multi-column cards on the new tab page, and to allow the user to organize, add, rename, move, and delete bookmarks locally.
```

### Permission Justification for `storage`
```text
Used to store preferences and layout locally and, where supported, in Chrome sync storage. The recently deleted bookmark recovery list is stored locally for up to seven days. Browser sync may transfer supported settings through the user's browser account.
```

### Permission Justification for `topSites` and `sessions`
```text
Used locally to render the optional "Top Sites" and "Recently Closed Tabs" widgets so users can quickly revisit their favorite or recently closed pages.
```

### Permission Justification for `identity`
```text
Used solely when the user explicitly clicks "Sign in with Google" to backup and restore their NTab layout configuration JSON file directly to their own private Google Drive (appDataFolder).
```

### Permission Justification for `history`
```text
Used as a local fallback to display recently closed sites when session information is unavailable. Browser history is not uploaded to the developer or included in the Google Drive configuration backup.
```

### Permission Justification for `favicon`
```text
Used to request bookmark icons from Chrome's internal favicon service for display on the new tab page.
```

---

## 3. 隐私权政策 (Privacy Policy)

- **隐私政策网址 (Privacy Policy URL)** 选项填写：
  `https://ntab-self.vercel.app/privacy`
  （2026-10-12 已部署修订后的 privacy.html，浏览器确认更新时间为 October 12, 2026；已上线不代表通过审核。）

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
- Non-empty columns automatically share the available width. Drag to create up to 10 columns; empty columns are removed automatically. Adjust horizontal whitespace to control the centered content area.
- Columns adapt to the available content area; long titles are truncated.
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
- Switch search engines from the search bar using the available keyboard shortcuts.

6. Offline-First with Optional Configuration Backup
- No tracking, no analytics SDKs, and zero advertising.
- Core bookmark management works without sign-in. Online search, icons, and link checking connect to their respective services.
- Some preferences use browser sync storage; optional Google sign-in caches account information and an access token locally.
- Optional Google Drive backup stores preferences and folder layout references, not a complete bookmark tree.

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
- 非空列自动均分宽度，拖动新增列、空列自动移除，最多新增到 10 列；可调横向留白。
- 无论开几个分列，屏幕两端零多余留白、不挤压、不截断。
- 支持上下、左右分列自由拖拽排序与卡片独立拆分。

2. 平滑滑动批量多选
- 独创向量线性插值采样算法，鼠标在书签列表上快速划过即可瞬时成批勾选。
- 支持一键批量移动至任意目录或一键批量清理。

3. 7天防手滑本地回收站
- 误删书签不再恐慌！所有删除操作自动转入 7 天本地回收站。
- 支持一键满血恢复原始位置，或永久彻底删除。

4. 超轻量书签失效体检
- 优先发送 HEAD 请求，必要时使用 GET 请求检查书签链接。
- 显示 404、403 等响应以辅助筛查；网站的登录要求或反爬限制可能影响结果，请确认后再删除。

5. 全局秒级搜索与 AI 聚合快捷切换
- 支持 Google、必应、百度、DuckDuckGo、GitHub 等主流搜索。
- 支持 ChatGPT、Gemini、DeepSeek、Perplexity 等 AI 快捷提问。
- 可在搜索栏使用界面提示的快捷键切换搜索引擎。

6. 离线优先与可选云备份
- 零分析代码、零用户追踪、零广告插件。
- 核心书签管理无需登录；在线搜索、图标加载和失效检测会连接相关服务。
- 部分设置使用浏览器同步存储；可选 Google 登录会在本地缓存账号资料与访问令牌。
- Google Drive 备份包含偏好设置与书签文件夹布局引用，不是完整书签备份。

GitHub 开源仓库：https://github.com/noby338/ntab
开源许可：MIT License
```

---

## 5. 常见分类选择 (Category)

- **分类 (Category)**: `Productivity` (生产力工具) / `Workflow & Planning` (工作流与规划)
- **定价**: `Free` (完全免费)

## 6. 本次后台保存记录

2026-10-12 已进入现有 Chrome 条目，确认公开版本为 1.0.1。商品描述与官网关联、隐私披露和审核测试说明已保存到草稿；以 RELEASE_CHECKLIST.md 中的实际进度为准。

数据类型已选：个人身份信息（Google 名称、邮箱）、身份验证信息（访问令牌）、网络记录（本地历史与常访/最近关闭信息）、网站内容（书签标题与链接）。本地处理也需披露：https://developer.chrome.com/docs/webstore/program-policies/user-data-faq 。
