# Implementation Plan - OSS 文件读取优化

为了提升页面加载速度并减少用户看到的 Loading 时间，我们将实施以下优化方案：

## 1. 核心思路
- **Stale-While-Revalidate (SWR) 模式**：优先显示本地缓存的旧数据，后台异步获取最新数据。
- **非阻塞 Loading**：仅在初次加载且本地无缓存时显示全屏 Loading。
- **持久化缓存**：将获取到的数据保存到 `sessionStorage`，实现在同一会话内切换页面的“秒开”体验。

## 2. 修改任务清单

### 任务一：增强 `usePolling` Hook
- [ ] 支持 `cacheKey` 参数。
- [ ] 初始化时尝试从缓存读取数据。
- [ ] 成功获取数据后自动同步到缓存。
- [ ] 优化 `loading` 状态逻辑，确保在有缓存数据时，后续更新不会触发全局 loading 遮罩。

### 任务二：优化 `BracketsPage` (淘汰赛页面)
- [ ] 为 `usePolling` 传递基于 `sportCode` 和 `eventCode` 的唯一 `cacheKey`。
- [ ] 修改页面渲染逻辑：仅在 `loading && bracketData.length === 0` 时显示 `LoadingOverlay`。

### 任务三：后端接口聚合优化 (Composite Request)
- [ ] 在 `/api/batchFetch` 中引入 `fullBracket` 类型。
- [ ] 后端内部聚合 `dualPhase` 与所有关联的 `dualPhaseMatch` 读取，减少客户端往返次数。
- [ ] 更新 `BracketsPage` 使用聚合接口。

### 任务四：通用优化
- [ ] 检查其他使用 `usePolling` 的页面，按需同步优化。

## 3. 技术细节
- 缓存介质：`sessionStorage` (适合单次会话，不会因为过期数据导致逻辑错误)。
- 缓存键名格式：`cache_poll_${cacheKey}`。

## 4. 预期效果
- 再次访问页面或刷新时，数据几乎瞬间出现。
- 只有在首次访问该比赛且网络慢时，用户才会看到 Loading 动画。
