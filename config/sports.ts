// 运动项目配置 - 现在只用于显示名称等元信息，不再限制可用的 sportCode
export interface SportConfig {
  code: string
  name: string
  baseUrl: string
}

// 可选的运动项目配置，用于提供更好的用户体验（如显示名称）
export const SPORTS_CONFIG: Record<string, SportConfig> = {
  bk0401: {
    code: "bk0401",
    name: "击剑锦标赛",
    baseUrl: "https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore/bk0401",
  },
  // 可以添加更多运动项目的显示信息
}

export function getSportConfig(sportCode: string): SportConfig {
  // 如果在配置中找到，返回配置的信息
  if (SPORTS_CONFIG[sportCode]) {
    return SPORTS_CONFIG[sportCode]
  }

  // 如果没有在配置中找到，动态生成配置
  return {
    code: sportCode,
    name: `运动项目 ${sportCode}`,
    baseUrl: `https://yyfencing.oss-cn-beijing.aliyuncs.com/fencingscore/${sportCode}`,
  }
}

// 移除严格的验证，现在任何非空字符串都是有效的 sportCode
export function isValidSportCode(sportCode: string): boolean {
  // 基本验证：非空且不包含特殊字符
  return !!sportCode && sportCode.length > 0 && /^[a-zA-Z0-9_-]+$/.test(sportCode)
}
