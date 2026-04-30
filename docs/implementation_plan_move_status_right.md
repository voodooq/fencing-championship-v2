# Implementation Plan - 调整首页状态列对齐方式

## 任务目标
调整首页赛事列表“状态”列的对齐方式，将其向右移动。

## 变更详情
1. 修改 `components/schedule.tsx`:
   - 找到表头定义，将第 3 列（状态）添加 `text-right`。
   - 找到列表项定义，将第 3 列（状态文字）添加 `text-right`。

## 验证步骤
- 启动项目并检查首页表格布局。
