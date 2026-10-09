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
  app/content/notes/   笔记，一篇一个 .mdx
  app/site.ts          导航、玩具和工具清单，首页和 sitemap 都读它
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

- **一篇笔记**：在 `apps/web/app/content/notes/` 加一个 `.mdx`，导出 `frontmatter`（title、date、summary）。可以直接 `import { Quiz } from '@shiqi/ui'`。
- **一个工具**：逻辑写在 `app/features/tools/x.ts` 并配 `x.test.ts`，页面写在 `app/routes/tools/x.tsx`，在 `routes.ts` 和 `site.ts` 各加一行。
- **一个 API**：在 `app/routes/api/` 加一个只导出 `loader` / `action` 的文件，在 `routes.ts` 的 `api` 前缀下注册。

## 部署

见 [docs/deploy.md](docs/deploy.md)。简单说：推到 `main` → GitHub Actions 检查并构建多架构镜像推到 GHCR → SSH 到服务器，用 Docker Compose 换上新镜像。

## 约定

- 时间用 ISO 8601，UUID 用 v7，文本用 UTF-8。
- 动画尊重 `prefers-reduced-motion`；颜色对比度按 WCAG AA。
- 不放追踪脚本，不设 Cookie。

字体 Silkscreen 使用 SIL Open Font License（见 `apps/web/public/fonts/OFL.txt`）。
