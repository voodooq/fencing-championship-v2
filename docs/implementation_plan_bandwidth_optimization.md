# 带宽优化实施计划

## 目标

在不影响用户体验和实时性的前提下，将 4 个未优化的子页面和 Layout 层迁移到智能轮询机制，
预计将带宽从 ~258 MB/h 降低到 ~102 MB/h（再降约 60%）。

## 核心策略

1. **统一使用 `usePolling` Hook**：所有轮询页面统一接入，获得指数退避 + 可见性感知 + ETag
2. **统一使用 `batchFetch` API**：所有页面统一走 POST `/api/batchFetch`，获得 ETag 指纹比对
3. **brackets 合并请求**：利用已有的 `fullBracket` 组合请求类型

## 变更范围

| 文件 | 变更类型 | 风险等级 |
|------|----------|---------|
| `rankings/page.tsx` | 迁移到 `usePolling` + `batchFetch` | 低 |
| `groups/page.tsx` | 迁移到 `usePolling` | 低 |
| `checkin/page.tsx` | 迁移到 `usePolling` | 低 |
| `rounds/page.tsx` | 迁移到 `usePolling` | 中 |
| `brackets/page.tsx` | 合并为 `fullBracket` + 补全 ETag | 中 |
| `layout.tsx` | 加入退避 + 数据比对 | 中 |

## 实施顺序

按风险从低到高排序，每完成一个页面可独立验证。

### Phase 1：简单页面迁移（低风险）
1. `rankings/page.tsx` — 最简单，单一数据源
2. `groups/page.tsx` — 简单，已使用 batchFetch

### Phase 2：中等页面迁移（低-中风险）
3. `checkin/page.tsx` — 需要先获取 sysData
4. `rounds/page.tsx` — 多步依赖获取

### Phase 3：复杂优化（中风险）
5. `brackets/page.tsx` — 合并请求 + ETag
6. `layout.tsx` — 加入退避逻辑

## 验证方法

1. 功能验证：每个页面手动测试数据加载和自动刷新
2. 带宽验证：浏览器 DevTools Network 面板观察请求频率和大小
3. 退避验证：数据无变化时观察请求间隔是否逐步增加
