# NTab 正式发布操作清单

更新日期：2026-10-12。官网按用户选择继续使用 https://ntab-self.vercel.app/ 。

## 已完成与待完成

- [x] 修正 Google OAuth 回调中的扩展 ID 拼写，测试账号已成功登录。
- [x] 将 tanyang338@gmail.com 加入测试用户名单。
- [x] 在浏览器确认现有线上隐私政策可访问。
- [x] 修订本地 privacy.html，说明 Google 账号缓存、浏览器同步、云备份内容、外部请求和数据删除方式。
- [x] 修复首次登录缺少远程备份时不创建备份的问题。
- [x] Drive 查询失败不再被当作“没有备份”，避免误创建备份文件。
- [x] 增加 OAuth state 校验、回调地址校验、过期账号缓存清理和同步前过期提示。
- [x] 自动检查覆盖首次备份、错误 state、Drive 403/500、过期同步与过期缓存；类型检查通过。
- [x] 重新部署官网修订后的隐私政策（2026-10-12，提交 57c1048；Vercel Production Ready，正式网址已核对）。
- [x] 保存 Google 品牌资料：官网、隐私政策链接和 ntab-self.vercel.app 授权网域（2026-10-12；后台提示已保存，发布按钮已可用）。
- [x] 完成 Google 要求的网站所有权验证（2026-10-12 21:05 左右，Search Console 提示“已完成所有权验证”，方法 HTML 标记；首页提交 61fc889 已部署）。
- [x] OAuth 正式发布（2026-10-12，目标对象页显示“正式版”）。
- [ ] 完成品牌验证并发布品牌（2026-10-12 自动验证曾因官网所有权未验证而失败；现所有权已通过。Google 要求等待 24 小时再重试，最早 2026-10-13 21:05 北京时间；数据访问无需敏感或受限范围验证）。
- [x] 最终 1.0.4 构建已重新加载；账号授权补齐后云备份与恢复实测通过（2026-10-12 21:17）。临时把主题从 system 改为 cream，恢复后导出配置确认为 system，其余设置与布局保持原值。测试前配置副本：.output/config-before-release-test-2026-10-12.json。此前 403 insufficientPermissions 的原因是未授予 drive.appdata；Drive API 已启用。
- [ ] 用未加入测试名单的另一账号验证正式用户登录。
- [ ] 商店提交审核及通过后安装测试。

## 1. 更新官网隐私政策

本地文件：项目根目录 privacy.html；线上地址：https://ntab-self.vercel.app/privacy 。2026-10-12 已部署提交 57c1048，浏览器已确认线上显示 October 12, 2026 和修订内容。以下步骤留作后续更新参考。

1. 打开 https://vercel.com/dashboard ，登录拥有该网站的账号。
2. 找到域名为 ntab-self.vercel.app 的项目。
3. 在项目设置的 Git 页面确认关联仓库与生产分支。若关联当前 ntab 仓库，将本次修订提交并推送到该生产分支；Vercel 才能获取修改后的文件。
4. 在 Deployments 中等待对应新提交的部署变为 Ready，并确认它是 Production。仅对旧提交点击 Redeploy 不会上传本地修改。
5. 打开线上 /privacy ，确认显示 October 12, 2026，并包含 Data Access and Use、Optional Google Drive Backup、Retention and Your Controls 等章节。
6. 用未登录 Vercel 的浏览器确认首页和隐私政策都能访问，没有要求登录 Vercel 的保护页。

若项目未关联 Git，可用已有 Vercel 部署方式上传这次的静态站点文件；不要新建替代生产项目或改动已有域名。需要 Codex 继续操作时，先打开现有 Vercel 项目，以便核对实际部署方式。

## 2. 网站所有权验证（Google 要求时完成）

1. 使用 tanyang338@gmail.com 打开 https://search.google.com/search-console 。
2. 添加资源，选择“网址前缀”，输入 https://ntab-self.vercel.app/ 。不要选择需要控制 vercel.app DNS 的网域资源。
3. 选择 HTML 标记验证，复制 Google 生成的完整 meta 标记。
4. 把该标记加入项目根目录 index.html 的 head 中，再部署官网。
5. 回到 Search Console 点击验证；成功后保留标记，不要删除。

2026-10-12 约 21:05 已完成此项。Google 要求等待 24 小时同步，最早在 2026-10-13 21:05（北京时间）后回品牌页面重试。

验证标记必须由 Google 实际生成，不能编造。若 Google 不接受此托管域名，按返回的原因处理；必要时使用你能验证的自有域名。无需尝试验证 chromiumapp.org 的所有权。

## 3. 填写 Google OAuth 品牌资料

页面：https://console.cloud.google.com/auth/branding?project=gen-lang-client-0074688628

2026-10-12 已保存应用名称、支持邮箱、首页、隐私政策和官网授权网域。后台提示“已保存品牌更改”，目标对象页的“发布应用”按钮已可用。服务条款未建立，链接留空；网站所有权已在 Search Console 验证成功，品牌验证仍需等待 Google 同步。

| 字段 | 填写内容 |
| --- | --- |
| 应用名称 | NTab |
| 用户支持邮箱 | tanyang338@gmail.com |
| 应用首页 | https://ntab-self.vercel.app/ |
| 隐私政策链接 | https://ntab-self.vercel.app/privacy |
| 服务条款链接 | 目前可留空；有真实公开的条款后再填写，不能填不存在的页面 |
| 已获授权的网域 | 添加 ntab-self.vercel.app（只填主机名，不加 https 或路径），保留系统 chromiumapp.org |
| 开发者联系邮箱 | tanyang338@gmail.com |

1. 先完成第 1 步，确认线上政策与实际实现一致，再填写并保存。
2. 徽标可使用 public/icon/128.png；按页面支持的格式和尺寸要求上传。
3. 如出现网域或验证错误，记录完整错误，再处理，不要通过删除回调地址绕过。
4. 开发者邮箱、支持邮箱要能收信，审核补充资料通知会发送到这些地址。

## 4. 核对权限并正式发布 OAuth

1. 打开 Google Auth Platform 的“数据访问”，确认与代码请求一致：openid、userinfo.email、userinfo.profile、drive.appdata。
2. drive.appdata 仅用于应用配置文件，不要为方便申请整个 Drive 访问权限。
3. 回到“目标对象”，点击“发布应用”，阅读确认内容，发布后确认状态为“正式版 / In production”。这与 Chrome 商店发布互相独立。
4. 依照品牌页面和验证中心的实际提示执行品牌验证；如页面要求 Verify Branding，完成后再 Publish branding，使验证后的品牌资料生效。旧版界面按钮可能不同。
5. 自动验证不能完成时，按页面要求提交人工审核，并查看开发者邮箱中的补充资料要求。通过与否由 Google 决定。
6. 用没有加入测试名单的普通 Google 账号测试，确认不再出现“仅供测试人员使用”的 403。

OAuth 已切换为正式版。接受法律条款、新增账号访问授权或完成身份验证时，仍需按实际页面由你确认或操作；审核结果由 Google 决定。

## 5. 安装并实际测试本次安装包

准备包：.output/ntab-1.0.4-chrome.zip。它是测试候选包，自动检查通过不代表真实账号同步已经验证。

1. 先在 NTab 导出一份本地配置，保留现有设置的恢复副本。
2. 在 chrome://extensions 找到 NTab，确认加载路径为本项目 .output/chrome-mv3，点击重新加载，然后刷新 NTab 页面。若实际安装来自商店，改用独立测试浏览器配置加载本地包，避免影响正式安装。
3. 重新登录测试账号。确认头像/邮箱显示，拒绝云盘权限时能够看到备份失败信息。
4. 点击“备份到云端”，确认成功提示和同步时间更新。
5. 将主题修改为另一个主题，再点击“从云端恢复”，确认恢复到备份中的主题。
6. 等待令牌到期后再试备份，确认提示重新登录；重新登录后同步应可恢复。当前实现需重新登录，不是自动后台续期。
7. 在独立浏览器配置或另一台设备中登录，同步设置并确认布局能按已有书签文件夹匹配。此功能不会替你创建缺失的完整书签树。
8. 完成第 4 节后，用非测试名单账号重复登录和备份测试。

“恢复”会更改主题与布局；先导出副本，再做验证。首次登录也可能恢复已有云配置。未进行真实账号测试的项目，不要勾选完成。

## 6. Chrome Web Store 提交

1. 打开 https://chrome.google.com/webstore/devconsole ，登录开发者账号。若需要注册、支付费用、接受协议或身份验证，由你完成。
2. 优先打开已有 NTab 条目，不要重复创建新条目。确认条目 ID 为 jbdjfhdiflipicnkhfcekhdgglohhjge；若不同，必须将真实商店 ID 对应的回调 URI 登记到 OAuth 客户端。
3. 上传最新 ZIP。若后台已有同版本且不允许再次上传，或 1.0.3 已发布，先提高 package.json 和 wxt.config.ts 中的版本并重新打包，不能上传旧包冒充新版本。
4. 填写名称、简介、详细描述、分类；上传 store-assets 下的截图与宣传图、public/icon/128.png 图标。复核截图没有私人书签、邮箱或其他不希望公开的信息。
5. 在隐私设置中填写线上隐私政策 URL，按真实处理的数据填写披露：账号资料、书签/历史访问用途、配置与布局等，不能简单因为“没有自建服务器”就选择“不处理任何用户数据”。
6. 逐项填写权限说明，参考 STORE_SUBMISSION_GUIDE.md 修订后的文案。广泛主机访问用于失效检测和 Google API；不保证审核通过，Google 可能要求缩减权限。
7. 按当前代码如实声明远程代码情况，并检查所有必填项目和后台警告。
8. 提交审核前完成第 5 节的实际测试。审核通过后，从商店安装到干净的浏览器配置，用普通账号再测试。

## 资料来源

- Google OAuth 受众与发布状态：https://support.google.com/cloud/answer/15549945
- Google 品牌验证与首页、隐私政策要求：https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- Search Console 网站验证：https://support.google.com/webmasters/answer/9008080
- Vercel Git 部署：https://vercel.com/docs/git
- Chrome 商店发布：https://developer.chrome.com/docs/webstore/publish
- Chrome 商店隐私政策：https://developer.chrome.com/docs/webstore/program-policies/privacy

## 本次发布补充记录

- 候选版本已升级为 1.0.4；安装包 .output/ntab-1.0.4-chrome.zip。
- 商店身份验证已完成。后台确认条目已公开发布 1.0.1；正在准备同一条目的 1.0.4 更新。用户已批准上传，1.0.4 安装包已成功上传并处理完成，后台草稿版本确认为 1.0.4；公开版本仍为 1.0.1，尚未提交审核。
- 两张现有商店截图已人工查看，使用演示书签与通用账号名，未发现私人邮箱或私人书签；第二张是历史 v1.0.0 设置展示。
- 修复新标签页内联初始化脚本被 Chrome CSP 拦截的问题：移到本地 theme-init.js，不放宽安全策略。
- 缺少 Google Drive 权限时，显示重新授权的具体指引；令牌过期提示在退出状态也可见。

### 2026-10-12 真实同步测试记录

1. 用户完成 Google 配置数据授权后，21:13 首次备份成功。
2. 重新加载最终 1.0.4 构建后，21:17:00 再次备份成功。
3. 将主题从 system 临时改为 cream，设置导出中确认 theme 为 cream。
4. 21:17:18 点击云端恢复，提示成功；重新打开账号配置后 theme 为 system，原配置恢复。
5. 未代替其他 Google 账号授权，非测试账号与跨设备验证仍待完成。

### Chrome 商店草稿资料

- 已保存修订后的英文描述：说明离线核心功能、网络请求、可选 Google 配置备份及不是完整书签备份。
- 官方网址已选 https://ntab-self.vercel.app/，支持网址已去除尾部空格。
- 权限理由已修订 storage、history、host permissions，说明浏览器同步、网络请求与 Google API。
- 数据类型已按实际处理勾选个人身份信息、身份验证信息、网络记录、网站内容；其余未勾选。原有三项用途声明保留。依据 Google 官方要求，本地处理也需披露。
- 测试说明已保存：核心功能免登录；可选 Google 同步用审核者本人账号授权，测试备份、更换主题、恢复；不提供开发者账号密码。
- 已有图标、两张截图和两种宣传图保留。

### 1.0.4 上传结果

- 用户明确批准后，已上传 .output/ntab-1.0.4-chrome.zip，后台处理完成。
- 文件包页：草稿 1.0.4，已发布 1.0.1；扩展 ID 仍为 jbdjfhdiflipicnkhfcekhdgglohhjge。
- 上传后的商品描述、官网关联及图片保留；分发设置为免费、公开、所有地区。
- 自动审批审查拦截“提请审核”点击，理由：已明确批准上传，但没有明确批准提交审核。未绕过，等待用户明确同意送审。
