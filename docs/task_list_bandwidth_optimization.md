# 带宽优化任务清单

## Phase 1：简单页面迁移

- [x] Task 1: `rankings/page.tsx` 迁移到 `usePolling`
  - 将 `getSysData` GET 改为 `batchFetch` POST（获得 ETag 支持）
  - 用 `usePolling` 替代 `setInterval` + 手动 visibility 处理
  - 验证排名数据正常加载和自动刷新

- [x] Task 2: `groups/page.tsx` 迁移到 `usePolling`
  - 将 fetchData 逻辑封装为 `fetchFn` callback
  - 用 `usePolling` 替代 `setInterval`
  - 保留 poolData + poolRankings 的状态映射
  - 验证小组赛成绩和排名正常显示

## Phase 2：中等页面迁移

- [x] Task 3: `checkin/page.tsx` 迁移到 `usePolling`
  - 将 fetchData 逻辑封装为 `fetchFn` callback
  - 保留 sysData 获取 event 的兜底逻辑
  - 用 `usePolling` 替代 `setInterval`
  - 验证检录数据正常加载

- [x] Task 4: `rounds/page.tsx` 迁移到 `usePolling`
  - 合并多步 fetch 为单一 `fetchFn`
  - 用 `usePolling` 替代 `setInterval`
  - 验证比赛轮次信息正常显示

## Phase 3：复杂优化

- [x] Task 5: `brackets/page.tsx` — 已确认优化完成
  - 已使用 `fullBracket` 组合请求（单次 batchFetch）
  - 已传递 ETag 给 batchFetch
  - 已使用 `usePolling` Hook

- [x] Task 6: `layout.tsx` 加入退避逻辑
  - 替换 `setInterval` 为递归 `setTimeout`
  - 加入数据变化检测（JSON 比对）
  - 数据无变化时指数退避（10s → 20s → 40s → 60s）
  - 数据变化时立即恢复 10s 间隔
  - 验证赛事标题、导航等正常更新

## 构建验证

- [x] `npx next build` 编译通过，无类型错误
