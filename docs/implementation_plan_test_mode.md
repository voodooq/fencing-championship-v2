# Implementation Plan - 动态测试模式标题

## 任务目标
实现基于环境变量 `TestModle` 的标题后缀动态显示。

## 变更详情
1. **新建 API**: `app/api/env/route.ts` 暴露 `TestModle` 状态。
2. **新建 Hook**: `hooks/use-test-mode.ts` 供客户端调用。
3. **修改组件**:
   - `components/header.tsx`: 修改首页标题。
   - `app/[sportCode]/event/[name]/layout.tsx`: 修改赛事详情页标题。

## 验证步骤
- 设置环境变量 `TestModle=true` 验证显示。
- 设置环境变量 `TestModle=false` 验证隐藏。
