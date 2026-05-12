# 服务端性能优化 — 任务清单

## ✅ 已完成的任务

### Task 1：提取共享缓存模块 ✅
- **文件**：新建 `lib/server-cache.ts`
- **改动**：
  - 实现统一的缓存模块，包含内存缓存、SWR、请求合并、负缓存
  - 为每个缓存条目添加版本号（自增数字），用于快速 ETag 计算
  - 重构 4 个 API 路由使用共享缓存
- **收益**：代码量减少 ~200 行，相同 URL 只缓存一份，4 个 API 共享一份内存

### Task 2：优化 ETag 计算方式 ✅
- **文件**：`app/api/batchFetch/route.ts`、`lib/server-cache.ts`
- **改动**：
  - 在缓存模块中为每个 URL 维护版本号
  - ETag = 各请求 key 的版本号拼接排序（几十字节 vs 100KB+）
  - 完全消除 `JSON.stringify(results)` 和 `MD5(大JSON)` 的 CPU 开销
  - 移除了 `crypto` 模块依赖
- **收益**：CPU 使用率下降 40-60%

### Task 3：首页迁移到 usePolling + batchFetch ✅
- **文件**：`app/[sportCode]/page.tsx`
- **改动**：
  - 将 `setInterval` + `getAllData` 替换为 `usePolling` + `batchFetch`
  - 同时获取 sysData 和 eventState，减少请求次数
  - 获得 ETag 指纹比对、指数退避、可见性感知、sessionStorage 秒开
- **收益**：首页带宽减少 50-80%

### Task 4：通过 React Context 消除子页面重复请求 ✅
- **文件**：
  - 新建 `contexts/event-data-context.tsx`
  - 修改 rounds/checkin/participants 页面
- **改动**：
  - Layout 通过 EventDataProvider + usePolling 轮询 sysData
  - 子页面通过 `useEventData()` 获取共享的 event 信息
  - 子页面不再单独请求 sysData，只请求自己需要的特定数据
- **收益**：每个子页面减少 1 次 batchFetch 调用

### Task 5：Nginx 代理缓存 + 静态资源优化 ✅
- **文件**：`nginx.conf`
- **改动**：
  - 添加 `proxy_cache` 配置，API 响应 10 秒缓存
  - 支持 POST 请求缓存（使用 URI + body 作为 key）
  - `/_next/static/` 添加 1 年不可变缓存
  - Banner 图片单独配置 5 分钟缓存
  - 添加 `X-Cache-Status` 头便于调试
- **收益**：多客户端并发请求时 Nginx 只向 Node.js 发 1 次

### Task 6：Layout 迁移到 usePolling + batchFetch ✅
- **文件**：`app/[sportCode]/event/[name]/layout.tsx`
- **改动**：
  - 用 EventDataProvider + usePolling 替代手动 setTimeout + getAllData
  - 通过 Context 共享数据给子页面
  - 获得 ETag 指纹比对、指数退避、可见性感知
- **收益**：Layout 轮询带宽减少 50-80%，消除重复请求

## 📊 预期总体收益

| 指标 | 优化前 | 优化后 | 改善幅度 |
|------|--------|--------|----------|
| CPU 使用率 | 高（stringify + MD5） | 低（版本号拼接） | ↓ 40-60% |
| 单次轮询带宽 | 完整 JSON 每次传输 | ETag 304 时零传输 | ↓ 50-80% |
| 子页面请求数 | 2-3 次/轮询周期 | 1 次/轮询周期 | ↓ 50% |
| 首次加载时间 | 需等待完整数据 | sessionStorage 秒开 | ↓ 2-5 秒 |
| Nginx 缓存 | 无 | API 10s + 静态 1年 | ↑ 显著 |

## 📁 改动文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `lib/server-cache.ts` | 新增 | 共享缓存模块（版本号 + SWR + 请求合并） |
| `contexts/event-data-context.tsx` | 新增 | 事件数据 Context Provider |
| `app/api/batchFetch/route.ts` | 重写 | 使用共享缓存 + 版本号 ETag |
| `app/api/getAllData/route.ts` | 重写 | 使用共享缓存 |
| `app/api/getSysData/route.ts` | 重写 | 使用共享缓存 |
| `app/api/getBracketData/route.ts` | 重写 | 使用共享缓存 |
| `app/[sportCode]/page.tsx` | 重写 | usePolling + batchFetch |
| `app/[sportCode]/event/[name]/layout.tsx` | 重写 | EventDataProvider + usePolling |
| `app/[sportCode]/event/[name]/rounds/page.tsx` | 修改 | 使用 useEventData |
| `app/[sportCode]/event/[name]/checkin/page.tsx` | 修改 | 使用 useEventData |
| `app/[sportCode]/event/[name]/participants/page.tsx` | 修改 | 使用 useEventData |
| `nginx.conf` | 重写 | 代理缓存 + 静态资源优化 |
