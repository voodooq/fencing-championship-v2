# 安全代码审查与修复方案 (Security Review and Fixes)

## 1. 发现的安全隐患

通过对整个前端代码和 API 路由的审查，发现了两个主要的安全风险类别：

### 1.1 SSRF (服务端请求伪造) 与 Path Traversal (路径遍历) 漏洞
在所有的 `app/api/**/route.ts` 中，API 接收来自客户端的查询参数（如 `sportCode`, `eventCode`, `directory`, `phaseId`），并**直接拼接**到 `BASE_URL` 用于发起服务器端的 HTTP 请求，而没有对这些参数的内容进行格式验证（如确保它们不包含 `../` 或者是恶意 URL）。

如果恶意用户传入类似 `sportCode=../../../some-other-bucket/secret`，有可能会导致服务器端的路径遍历攻击，导致非预期的数据被读取或产生不可控的服务端请求（SSRF）。

涉及的路由：
* `app/api/batchFetch/route.ts`
* `app/api/getAllData/route.ts`
* `app/api/getBanner/route.ts`
* `app/api/getBracketData/route.ts`
* `app/api/getSysData/route.ts`

### 1.2 XSS (跨站脚本攻击) 漏洞
在 `app/[sportCode]/event/[name]/rounds/page.tsx` 中使用了 `dangerouslySetInnerHTML` 来渲染比赛说明。
```tsx
dangerouslySetInnerHTML={{
  __html: eventFormat.FormatPoolDesc ? ...
}}
```
如果 OSS 数据源被篡改，或者存在恶意的赛事配置描述，这就为攻击者提供了执行恶意 JavaScript 脚本的途径。

## 2. 实施的修复方案 (Implementation Plan)

### 2.1 修复 SSRF 与路径遍历漏洞
我们在所有的服务端路由中，对于来自用户传入的路径参数增加严格的白名单/正则表达式校验：
1. **sportCode 校验**: 引入了已经存在的 `@/config/sports` 中的 `isValidSportCode` 工具函数。它通过 `/^[a-zA-Z0-9_-]+$/` 确保 `sportCode` 只能包含大小写字母、数字、下划线和连字符。
2. **其他路径参数校验**: 对于 `eventCode`, `phaseId` 和 `directory`，同样使用正则表达式 `/^[a-zA-Z0-9_-]+$/` 进行格式限定，从源头封堵任何带有 `../` 或者 `/` 字符的注入企图。

### 2.2 修复 XSS 漏洞
移除了 `rounds/page.tsx` 中存在风险的 `dangerouslySetInnerHTML`。由于原来的逻辑只是通过分号进行文本分割并用 `<p>` 标签包裹，我们可以完全使用 React 推荐的安全渲染方式（映射并返回 React Elements）来替代它：
```tsx
{eventFormat.FormatPoolDesc.split(/[;；]/).map((part, index) => (
    part.trim() ? <p key={index}>{part.trim()}</p> : null
))}
```
这种方式由 React 负责处理 HTML 转义，100% 防止 XSS 攻击。

## 3. 任务清单 (Task List)

- [x] 审查代码，定位所有直接拼接外部参数构建服务器内部请求 URL 的地方。
- [x] 审查所有的 `dangerouslySetInnerHTML` 使用场景。
- [x] 在 `getBanner/route.ts` 中加入 `isValidSportCode` 校验。
- [x] 在 `getAllData/route.ts` 中加入 `isValidSportCode` 校验。
- [x] 在 `getBracketData/route.ts` 中加入对 `sportCode` 和 `eventCode` 的安全校验。
- [x] 在 `getSysData/route.ts` 中加入对 `sportCode`, `eventCode` 和 `phaseId` 的正则安全校验。
- [x] 在 `batchFetch/route.ts` 中加入对批量请求列表里各个参数的严格正则过滤，防御多维度的路径注入。
- [x] 重构 `rounds/page.tsx`，用 React 安全映射替代 `dangerouslySetInnerHTML`。

## 4. 思考过程 (Thought)

在进行安全审查时，首要重点应当是边界安全：即从外部（客户端请求）跨越到内部信任域（Node.js 服务端发起请求至 OSS 或内网服务）的过程中，必须要设立明确的数据守卫(Data Guard)。

遵循**不要信任任何客户端输入**的原则，不能因为我们的应用逻辑中只有合法请求才会发生拼接，就放弃对异常请求的过滤。在 Node 服务中发起动态 `fetch` 请求时极易因为没做校验而形成 SSRF（Server-Side Request Forgery），因此利用正则校验拦截掉诸如 `..` 这样的相对路径符号是防护的基石。此外，利用框架特性(React 的 JSX 渲染默认对数据做字符转义) 避免使用 `dangerouslySetInnerHTML`，也是降低攻击平面的核心策略。
