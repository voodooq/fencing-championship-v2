# Implementation Plan - 修复参赛名单数据丢失问题

## 问题描述
目前参赛名单页面（Participants Page）显示为空白。
经过分析，原因在于：
1. `fetchFn` 返回的数据结构与 `useEffect` 中的处理逻辑不匹配。
2. 处理逻辑期望数据为“数组的数组”（多表结构），但实际返回的可能是单个“对象数组”。
3. 缺少对裁判员（referee）数据的请求逻辑。

## 任务清单
- [ ] 修改 `participants/page.tsx` 中的 `fetchFn`，增加 `referee` 目录请求。
- [ ] 优化 `fetchFn` 的返回值处理，确保返回的数据始终是“数据集数组”格式（`[[data1], [data2], ...]`）。
- [ ] 验证运动员列表显示是否正常。
- [ ] 验证裁判员列表显示是否正常。

## 详细修改方案

### `app/[sportCode]/event/[name]/participants/page.tsx`
- 在 `requests` 数组中增加 `{ key: "referees", directory: "referee", eventCode: ... }`。
- 定义一个辅助函数 `addToList`，用于将不同来源的数据（`startList`, `startListTeam`, `referees`）统一整合进一个二维数组。
- 无论原始数据是单表还是多表，最终都包装成 `[dataset1, dataset2, ...]` 的形式。
