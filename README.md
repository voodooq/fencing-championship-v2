# 击剑锦标赛赛程应用

这是一个使用Next.js和React开发的击剑锦标赛赛程展示应用。该应用允许用户查看比赛日程、筛选赛事，并提供了简洁的用户界面。

## 功能

- 展示击剑锦标赛赛程
- 按日期、组别、性别和剑种筛选赛事
- 响应式设计，适配移动端和桌面端
- 底部导航栏，方便切换不同页面
- 详细的赛事信息页面，包括轮次、参赛名单、小组赛、对阵表和最终排名

## 技术栈

- Next.js 13+ (使用App Router)
- React 18+
- TypeScript
- Tailwind CSS
- Lucide React (图标)

## 项目结构

- `app/`: Next.js 13+ 应用目录
  - `page.tsx`: 主页面
  - `api/`: API 路由
    - `getAllData/`: 获取所有数据的 API 路由
  - `event/[name]/`: 赛事详情页面
    - `page.tsx`: 赛事详情主页
    - `layout.tsx`: 赛事详情布局
    - `rounds/`: 比赛轮次页面
    - `participants/`: 参赛名单页面
    - `groups/`: 小组赛页面
    - `brackets/`: 对阵表页面
    - `rankings/`: 最终排名页面
- `components/`: React 组件
  - `header.tsx`: 页面头部组件
  - `banner.tsx`: 横幅组件
  - `filters.tsx`: 筛选器组件
  - `schedule.tsx`: 赛程表组件
  - `loading-overlay.tsx`: 加载蒙层组件
  - `bottom-nav.tsx`: 底部导航组件
- `public/`: 静态资源目录

## 开始使用

1. 克隆仓库
2. 安装依赖: `npm install`
3. 运行开发服务器: `npm run dev`
4. 在浏览器中打开 `http://localhost:3000`

## 部署

该项目可以轻松部署到 Vercel 平台。只需将代码推送到 GitHub 仓库，然后在 Vercel 中导入该仓库即可。
