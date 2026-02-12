# 阶段 1: 安装依赖并构建
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# 阶段 2: 运行环境
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 仅从构建阶段复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 暴露端口
EXPOSE 3000

# Next.js standalone 会生成 server.js
CMD ["node", "server.js"]
