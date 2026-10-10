# shiqi.si

Shiqi 的像素小站，也是一个长期的 sandbox：小玩具、实用工具、笔记，以后还有课程笔记、在线小测验和各种后端服务。

金、绿、黑、白。方角、黑边、硬阴影。背景是一张会动的 1984 风格图标桌面。

## 快速开始

```bash
corepack enable          # 用 package.json 里锁定的 pnpm 版本
pnpm install
pnpm dev                 # http://localhost:5173
```

可选：本地起 Redis 和 Kafka

```bash
docker compose up -d
```

## 常用命令

| 命令                          | 作用                         |
| ----------------------------- | ---------------------------- |
| `pnpm dev`                    | 开发服务器（热更新）         |
| `pnpm build` / `pnpm preview` | 生产构建 / 本地跑生产版本    |
| `pnpm test`                   | Vitest 单元测试              |
| `pnpm typecheck`              | 全部包的 TypeScript 严格检查 |
| `pnpm lint` / `pnpm format`   | ESLint / Prettier            |
| `pnpm check`                  | 上面所有检查，CI 跑的就是它  |

## 结构

```
apps/web/              网站：React Router（服务端渲染）+ MDX
  app/routes/          页面和 API（routes.ts 是路由表）
  app/features/        纯逻辑（工具的算法、画板模型），都有测试
  app/content/notes/   笔记：journal/ 学习流水、commonplace/ 杂学、essays/ 随想，一篇一个 .mdx
  app/site.ts          导航、玩具和工具清单，首页和 sitemap 都读它
  app/i18n/            多语言：strings/en.ts 是全部文案的原文，zh.ts 是中文；翻译服务和按 IP 选语言
packages/ui/           @shiqi/ui 组件库：主题、tokens、React 组件
packages/pixel/        @shiqi/pixel 像素绘图库：不依赖框架
infra/                 服务器初始化和部署脚本；server/ 是 Docker Compose，k8s/ 留给以后的大机器
.github/workflows/     CI：检查 → 构建镜像 → 部署
```

### 组件库 `@shiqi/ui`

- **主题**是 `data-theme` 上的一组 CSS 变量：`day`、`night`、`gold`（1984 金）、`matcha`。组件只读语义变量（`--surface`、`--accent`……），所以加主题只要在 `themes.css` 里加一段。
- **组件**：Button、Card、Window、MenuBar、List、Field/TextInput/Select/Range/Checkbox、Segmented、Swatches、OutputList、Toast、PixelIcon、PixelCanvas、PixelDesktop、Quiz、Section、ThemeSelect……全部列在网站的 `/ui` 页。
- 类名统一 `ui-<block>__<element>--<modifier>`；需要渲染成路由链接时用 `as={Link}`，或用 `buttonClass()` / `cardClass()`。

### 像素库 `@shiqi/pixel`

调色板、可复现随机数（mulberry32 + FNV-1a）、Bayer 抖动、Bresenham 直线、中点圆、字符画图标、小怪生成器、风景、1984 图案、涂鸦墙。图标是字符画（`#` 墨、`o` 填充、`:` 网点），改一个像素会出现在 diff 里。

## 加东西

- **一篇笔记**：在 `apps/web/app/content/notes/<文件夹>/` 加一个 `.mdx`，导出 `frontmatter`（title、date、summary、topics）。文件夹在 `content/notes/folders.ts` 里登记。可以直接 `import { Quiz } from '@shiqi/ui'`。
  - `journal/`（学习流水）：每天一篇，文件名 `YYYY-MM-DD-<主题>.mdx`，按时间记当天做了什么、踩了什么坑、学到什么。
  - `commonplace/`（杂学）：一篇讲透一个通用主题（Docker、SSH、k8s…），不绑定某一天；已有的就更新它，别重复写。
  - 笔记正文用英文；topics 用小写连字符（`docker-compose`），尽量复用已有的话题。
  - 中文版由翻译服务自动生成（翻译后的版本是静态 HTML，小测验只在英文原文里能点）。
- **一段文案**：不要写死在组件里。加到 `app/i18n/strings/en.ts`，组件里用 `const { t } = useI18n()` 读；带变量的用 `{name}` 占位再 `format()`，带链接或加粗的用 `<tag>…</tag>` 再 `<Rich>`。`zh.ts` 里补上中文；忘了补的话，翻译服务会先机器翻译顶上。
- **一个工具**：逻辑写在 `app/features/tools/x.ts` 并配 `x.test.ts`，页面写在 `app/routes/tools/x.tsx`，在 `routes.ts` 和 `site.ts` 各加一行。
- **一个 API**：在 `app/routes/api/` 加一个只导出 `loader` / `action` 的文件，在 `routes.ts` 的 `api` 前缀下注册。

## 多语言

英文是原文。支持的语言都登记在 `app/i18n/locales.ts` 的 `LANGUAGES` 里：English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch。加一种语言只要在那里加一项（名字、`<html lang>`、翻译服务的语言代码、默认用它的国家）。

访客第一次来时这样选语言：网址里的 `?lang=<代码>` → 手动选过的记在 `lang` Cookie → IP 所在国家（查询用 [country.is](https://country.is)，按 IP 缓存 7 天；没登记的国家用英文）→ 浏览器的 `Accept-Language` → 英文。菜单栏右上角的下拉框随时切换。

简体中文的界面文案是手写的（`zh.ts`），其它语言整套由翻译服务（`app/i18n/translate.server.ts`）用免费的机器翻译生成，不用大模型。笔记的标题、摘要和正文所有语言都走翻译服务。结果按内容哈希缓存在 Redis 里，同一段文字每种语言只翻一次。没配 key 时网站照常工作，没翻译的地方显示英文。

| 环境变量                  | 作用                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `AZURE_TRANSLATOR_KEY`    | 用 Azure AI Translator（免费档 F0，每月 200 万字符）                                            |
| `AZURE_TRANSLATOR_REGION` | 资源不是 `global` 时填它的区域，比如 `northcentralus`                                           |
| `LIBRETRANSLATE_URL`      | 或者用自己部署的 [LibreTranslate](https://libretranslate.com)（开源，免费），需要 2 GB 以上内存 |
| `GEOIP_URL`               | 可选，IP 查国家的服务，`{ip}` 会被替换；设成 `off` 就不按 IP 选                                 |

生产环境里这些变量放在 GitHub 的 `production` environment secrets，名字前加 `APP_`（比如 `APP_AZURE_TRANSLATOR_KEY`），部署时自动写到服务器，见 [docs/deploy.md](docs/deploy.md)。

## 部署

见 [docs/deploy.md](docs/deploy.md)。简单说：推到 `main` → GitHub Actions 检查并构建多架构镜像推到 GHCR → SSH 到服务器，用 Docker Compose 换上新镜像。

## 约定

- 时间用 ISO 8601，UUID 用 v7，文本用 UTF-8。
- 动画尊重 `prefers-reduced-motion`；颜色对比度按 WCAG AA。
- 不放追踪脚本。唯一的 Cookie 是 `lang`，记住访客手动选的语言。

字体 Silkscreen 使用 SIL Open Font License（见 `apps/web/public/fonts/OFL.txt`）。
