export const DATA_REFRESH_INTERVAL = 10 // seconds — 客户端轮询间隔
export const DATA_POLLING_INTERVAL = DATA_REFRESH_INTERVAL * 1000 // milliseconds

// NOTE: 服务端内存缓存时长，与客户端轮询间隔一致以保证实时性
// 核心原理：100 个用户同时轮询，服务端只向 OSS 发 1 次请求（请求合并 + SWR）
export const SERVER_CACHE_DURATION = 10 // seconds — 保证数据最多 10 秒延迟

// NOTE: CDN stale-while-revalidate 时长
// CDN 缓存过期后，仍可使用旧数据返回给用户 + 后台向源站刷新
// 这样即使 CDN 缓存过期，用户也不会等待回源，回源只在后台发生
export const CDN_STALE_REVALIDATE = 30 // seconds — CDN 容忍的旧数据窗口

// NOTE: 首页轮询间隔（比赛事详情页更长，因为首页数据变化频率较低）
export const HOME_POLLING_INTERVAL = 15000 // 15 seconds

// NOTE: 非实时数据的轮询间隔（如参赛名单、比赛轮次等很少变化的数据）
export const STATIC_DATA_POLLING_INTERVAL = 30000 // 30 seconds
