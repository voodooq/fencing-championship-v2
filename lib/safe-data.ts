/**
 * 安全数组提取工具
 *
 * 核心场景：
 * OSS 文件请求可能返回以下任何格式：
 *   - 正常数组: [{...}, {...}]
 *   - 错误对象: {error: true, status: 404, message: "File not found"} (truthy!)
 *   - undefined / null
 *   - 非数组数据
 *
 * 不能用 `a || b || []`，因为错误对象是 truthy 的，会导致短路
 */

/**
 * 从多个候选值中提取第一个有效的数组
 * @param candidates - 按优先级排列的候选数据源
 * @returns 第一个是数组的候选值，全部不是数组则返回空数组
 *
 * @example
 * ```ts
 * // pollingData.eventState 可能是 {error: true}，sysData[5] 可能是 undefined
 * const eventStates = safeArray(pollingData.eventState, sysData[5])
 * // 只有真正的数组才会被返回，其他全部跳过
 * ```
 */
export function safeArray<T = any>(...candidates: unknown[]): T[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }
  return []
}
