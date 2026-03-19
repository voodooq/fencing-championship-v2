# ⚔️ 击剑锦标赛赛程应用 V2

一个使用 **Next.js 14** 和 **React 18** 开发的击剑锦标赛赛程展示应用。支持多运动项目动态路由，提供赛事日程查看、多维度筛选、赛事详情以及数据推送等功能，适配移动端与桌面端。

## ✨ 功能特性

- 📅 展示击剑锦标赛赛程，支持按日期、组别、性别和剑种筛选
- 🏆 赛事详情页面，包括：轮次、参赛名单、签到、小组赛、对阵表、最终排名
- 🔄 支持多运动项目动态路由（`/[sportCode]/...`），可按需扩展运动项目
- 📡 数据轮询自动刷新（默认 15 秒间隔），实时获取最新赛事信息
- 📲 响应式设计，适配移动端和桌面端
- 🧭 底部导航栏，方便切换不同赛事子页面
- 📤 数据推送管理页面（`/pushdata`）

## 🛠 技术栈

| 类别         | 技术                                     |
| ------------ | ---------------------------------------- |
| **框架**     | Next.js 14 (App Router, Standalone 输出) |
| **前端**     | React 18 + TypeScript                   |
| **样式**     | Tailwind CSS 3 + tailwindcss-animate     |
| **UI 组件**  | shadcn/ui (Radix UI 原子组件)            |
| **图标**     | Lucide React                             |
| **图表**     | Recharts                                 |
| **主题**     | next-themes（暗色/亮色模式）             |
| **表单**     | React Hook Form + Zod 校验               |
| **容器化**   | Docker（多阶段构建）                     |

## 📁 项目结构

```
fencing-championship-v2/
├── app/                          # Next.js App Router 目录
│   ├── page.tsx                  # 根页面（入口重定向）
│   ├── layout.tsx                # 全局布局
│   ├── globals.css               # 全局样式
│   ├── not-found.tsx             # 404 页面
│   ├── [sportCode]/              # 动态运动项目路由
│   │   ├── page.tsx              # 赛程主页（日程 + 筛选）
│   │   └── event/[name]/         # 赛事详情
│   │       ├── layout.tsx        # 赛事详情布局（含底部导航）
│   │       ├── page.tsx          # 赛事详情主页
│   │       ├── rounds/           # 比赛轮次
│   │       ├── participants/     # 参赛名单
│   │       ├── checkin/          # 签到信息
│   │       ├── groups/           # 小组赛
│   │       ├── brackets/         # 对阵表
│   │       └── rankings/         # 最终排名
│   ├── api/                      # API 路由
│   │   ├── getAllData/            # 获取全部赛事数据
│   │   ├── getBanner/            # 获取横幅数据
│   │   ├── getBracketData/       # 获取对阵表数据
│   │   ├── getSysData/           # 获取系统数据
│   │   └── batchFetch/           # 批量数据请求
│   └── pushdata/                 # 数据推送管理页面
├── components/                   # React 组件
│   ├── banner.tsx                # 横幅组件
│   ├── bottom-nav.tsx            # 底部导航组件
│   ├── filters.tsx               # 筛选器组件
│   ├── header.tsx                # 页面头部组件
│   ├── loading.tsx               # 加载状态组件
│   ├── schedule.tsx              # 赛程表组件
│   ├── theme-provider.tsx        # 主题提供者
│   └── ui/                       # shadcn/ui 基础组件（50+ 组件）
├── config/                       # 配置文件
│   ├── site.ts                   # 站点级配置（刷新间隔等）
│   └── sports.ts                 # 运动项目配置（名称、API 地址）
├── hooks/                        # 自定义 Hooks
│   ├── use-mobile.tsx            # 移动端检测
│   ├── use-polling.ts            # 数据轮询
│   └── use-toast.ts              # Toast 通知
├── lib/                          # 工具函数库
│   ├── sport-config.ts           # 运动项目路由 & API URL 构建
│   └── utils.ts                  # 通用工具函数（cn 类名合并等）
├── styles/                       # 样式目录
│   └── globals.css               # 全局 CSS 变量 & 基础样式
├── public/                       # 静态资源
├── Dockerfile                    # Docker 多阶段构建配置
├── docker-compose.yml            # Docker Compose 编排
├── next.config.mjs               # Next.js 配置（standalone 输出）
├── tailwind.config.ts            # Tailwind CSS 配置
├── tsconfig.json                 # TypeScript 配置
└── package.json                  # 项目依赖 & 脚本
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 8

### 本地开发

```bash
# 1. 克隆仓库
git clone <仓库地址>
cd fencing-championship-v2

# 2. 安装依赖
npm install

# 3. 配置环境变量（可选，参考 .env 文件）
# FENCING_API_BASE_URL - 赛事数据 API 基地址
# NEXT_PUBLIC_PUSH_DATA_API_BASE_URL - 数据推送 API 基地址

# 4. 启动开发服务器
npm run dev

# 5. 在浏览器中打开
# http://localhost:3000
```

### 可用脚本

| 命令             | 说明               |
| ---------------- | ------------------ |
| `npm run dev`    | 启动开发服务器     |
| `npm run build`  | 构建生产版本       |
| `npm run start`  | 启动生产服务器     |
| `npm run lint`   | 运行 ESLint 检查   |

## 🐳 Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动 Docker 构建

```bash
# 构建镜像
docker build --no-cache -t crpi-578c88c5toqsydb9.cn-zhangjiakou.personal.cr.aliyuncs.com/yyhub/fencing-competition-list:v5 .

# 推送镜像
docker push crpi-578c88c5toqsydb9.cn-zhangjiakou.personal.cr.aliyuncs.com/yyhub/fencing-competition-list:v5

# 拉取镜像
docker pull crpi-578c88c5toqsydb9.cn-zhangjiakou.personal.cr.aliyuncs.com/yyhub/fencing-competition-list:v5

# 运行容器
docker run -d \
  --name fencing-all-v5 \
  -p 3024:3000 \
  -e FENCING_API_BASE_URL=https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore/2026 \
  --restart unless-stopped \
  crpi-578c88c5toqsydb9.cn-zhangjiakou.personal.cr.aliyuncs.com/yyhub/fencing-competition-list:v5
```

## ⚙️ 环境变量

| 变量名                                | 说明                    | 默认值                                                                    |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `FENCING_API_BASE_URL`                | 赛事数据 API 基地址     | `https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore`              |
| `NEXT_PUBLIC_PUSH_DATA_API_BASE_URL`  | 数据推送 API 基地址     | `http://hhdata-d.yy-sport.com.cn:10087`                                   |

## 🏗 多运动项目支持

应用通过动态路由 `[sportCode]` 支持多运动项目。每个运动项目通过唯一的 `sportCode` 标识（如 `bk0401`），系统会自动根据 `sportCode` 构建对应的 API 请求地址。

**添加新运动项目**：在 `config/sports.ts` 中添加配置即可，无需修改路由代码。

```typescript
export const SPORTS_CONFIG: Record<string, SportConfig> = {
  bk0401: {
    code: "bk0401",
    name: "击剑锦标赛",
    baseUrl: "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore/bk0401",
  },
  // 添加更多运动项目...
}
```

## 📄 License

MIT