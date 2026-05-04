#!/bin/sh
# 启动 Next.js 在 3001 端口（Nginx 后面）
PORT=3001 node server.js &

# 启动 Nginx 在 3000 端口（对外暴露）
nginx -g 'daemon off;'
