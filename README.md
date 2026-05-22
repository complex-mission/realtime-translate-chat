<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-38bdf8?logo=tailwindcss" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Socket.io-4.8-black?logo=socket.io" alt="Socket.io">
  <img src="https://img.shields.io/badge/MySQL-8.0-4479a1?logo=mysql" alt="MySQL">
  <img src="https://img.shields.io/badge/Redis-7.0-dc382d?logo=redis" alt="Redis">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<h1 align="center">实时翻译群聊系统</h1>

<p align="center">
  多人语音会议 + 实时翻译字幕 · 内部团队跨语言沟通工具
</p>

<p align="center">
  中文 · English · 日本語 三语互译<br>
  语音实时翻译延迟 ≤ 3秒 · 翻译准确度 ≥ 94%
</p>

---

## 目录

- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [数据库初始化](#数据库初始化)
- [启动方式](#启动方式)
- [部署指南](#部署指南)
- [项目结构](#项目结构)
- [API 接口](#api-接口)
- [用户角色与权限](#用户角色与权限)
- [安全设计](#安全设计)
- [性能优化](#性能优化)
- [常见问题](#常见问题)
- [License](#license)

---

## 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| **多人语音通话** | 基于阿里云 RTC SFU 模式，支持多人同时发言，独立音频通道互不干扰 |
| **实时语音翻译** | Qwen3-LiveTranslate-Flash 端到端语音翻译，音频直出多语言文本 |
| **双层字幕显示** | 第一层：用户卡片实时滚动字幕（流式输出+自我修正）；第二层：聊天框语音转写消息（永久落库） |
| **文字消息翻译** | qwen3.5-plus 按需翻译，点击「翻译」按钮触发，Redis 缓存 24 小时 |
| **AI 会议纪要** | 手动触发，自动生成结构化纪要（主题/参会者/讨论/决策/待办/风险） |
| **术语表** | 全局 + 房间两级术语表，翻译时自动注入 prompt，保证专有名词一致性 |
| **图片消息** | 支持粘贴截图上传，阿里云 OSS 存储，签名 URL 访问 |
| **消息检索** | MySQL 全文索引，支持按关键词搜索文字和语音转写消息 |

### 通话功能

- 加入 / 退出通话
- 静音 / 取消静音
- 通话区域可收起 / 展开
- 独立音频通道（多人同时说话互不干扰）
- 实时字幕浮层（流式输出 + 自我修正）
- 字幕显示设置（原文+译文 / 仅原文 / 仅译文，字体大小调节）
- RTC 断线自动重连（2s → 4s → 8s，最多 3 次）
- VAD 语音活动检测（静音 2 秒暂停翻译，节约成本）
- AEC 回声消除 / ANS 噪声抑制 / AGC 自动增益

### 消息功能

- 四种消息类型：文字 / 图片 / 语音转写 / 系统消息
- 文字消息最大 5000 字符，Enter 发送
- 图片消息最大 10MB，支持 JPG/PNG/GIF/WebP
- 粘贴截图直接上传（Ctrl+V）
- 消息发送失败显示红色叹号 + 手动重试
- 向上滚动分页加载历史消息（每页 50 条）

### 聊天室管理

- 创建聊天室（名称 + 描述 + 邀请成员）
- 邀请链接（`/chat/join/{code}`）
- 踢出成员 / 关闭聊天室
- 一个用户同时只能在一个聊天室
- 房间列表显示未读消息数 + 最后消息预览

### 用户与权限

- 三级角色：管理员 / 室长 / 成员
- 管理员创建账号，首次登录强制改密
- 密码策略：8 位 + 至少两种字符类型
- 登录限流：5 次失败冻结 5 分钟，再次 5 次永久冻结
- IP 限流：24 小时 100 次登录请求

### 管理后台

- 用户管理（创建 / 编辑 / 冻结 / 解冻 / 重置密码）
- 聊天室管理（查看所有房间状态）
- 全局术语表维护
- 全局消息检索

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  Next.js 15 (App Router) + Tailwind CSS v4                  │
│  Socket.io Client (实时消息/字幕)                            │
│  阿里云 RTC Web SDK (音视频采集/播放)                        │
│  react-easy-crop (头像裁切)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                        后端层                                │
│  Next.js API Routes + 自定义 Server (Socket.io)             │
│  JWT 双令牌认证 (Access + Refresh)                           │
│  阿里云 RTC 服务端 SDK (音频流拉取)                          │
│  Qwen3-LiveTranslate-Flash (语音翻译)                        │
│  qwen3.5-plus (文字翻译/纪要生成)                            │
│  sharp (图片处理/WebP转换)                                   │
│  ali-oss (文件上传/签名URL)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                        数据层                                │
│  MySQL 8.0 (9张表 + 全文索引)                                │
│  Redis 7.0 (缓存/限流/在线状态/JWT黑名单/术语表)             │
│  阿里云 OSS (图片/头像存储)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 技术选型

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | Next.js (App Router) | 15+ | SSR + API Routes |
| UI 样式 | Tailwind CSS | 4.1 | 原子化 CSS |
| 实时通信 | Socket.io | 4.8 | 消息推送/字幕流/通话状态 |
| 音视频 | 阿里云 RTC | - | SFU 模式多人通话 |
| 语音翻译 | Qwen3-LiveTranslate-Flash | - | 端到端语音翻译 |
| 文字翻译 | qwen3.5-plus | - | 按需翻译/纪要生成 |
| 数据库 | MySQL | 8.0 | 持久化存储 |
| 缓存 | Redis | 7.0 | 多级缓存/限流 |
| 文件存储 | 阿里云 OSS | - | 图片/头像 |
| 图片处理 | sharp | 0.34+ | WebP转换/裁切 |
| 认证 | JWT (自实现) | - | 双令牌机制 |

---

## 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **MySQL** >= 8.0
- **Redis** >= 7.0
- **npm** >= 10.0.0

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/realtime-translate-chat.git
cd realtime-translate-chat

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env.local
```

### 配置环境变量

编辑 `.env.local`，填写以下必要配置：

```env
# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rt_translate

# Redis
REDIS_URL=redis://:password@127.0.0.1:6379/0

# JWT 密钥（务必改为随机强密码）
JWT_ACCESS_SECRET=your_access_secret_at_least_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_at_least_32_chars

# 阿里云 DashScope（翻译/纪要）
DASHSCOPE_API_KEY=your_dashscope_api_key

# 管理员初始账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@12345
ADMIN_NICKNAME=管理员
```

### 初始化数据库

```bash
# 创建表结构（9张表）
npx tsx scripts/migrate.ts

# 创建管理员账号
npx tsx scripts/seed.ts
```

### 启动

```bash
# 开发模式（含 Socket.io 实时功能）
npm run dev
```

访问 http://localhost:19716，使用管理员账号登录。

---

## 环境变量配置

| 变量名 | 必填 | 说明 | 默认值 |
|--------|------|------|--------|
| `APP_NAME` | 否 | 应用名称 | RealTime Translate Chat |
| `APP_URL` | 否 | 应用 URL | http://localhost:19716 |
| `ALLOWED_ORIGINS` | 否 | 允许的 CORS 来源（逗号分隔） | 同 APP_URL |
| `NODE_ENV` | 否 | 环境 | development |
| `DB_HOST` | 是 | MySQL 主机 | 127.0.0.1 |
| `DB_PORT` | 否 | MySQL 端口 | 3306 |
| `DB_USER` | 是 | MySQL 用户名 | root |
| `DB_PASSWORD` | 是 | MySQL 密码 | - |
| `DB_NAME` | 是 | 数据库名 | rt_translate |
| `REDIS_URL` | 是 | Redis 连接 URL | redis://127.0.0.1:6379/0 |
| `JWT_ACCESS_SECRET` | 是 | JWT Access 密钥 (≥32字符) | - |
| `JWT_REFRESH_SECRET` | 是 | JWT Refresh 密钥 (≥32字符) | - |
| `DASHSCOPE_API_KEY` | 是 | 阿里云 DashScope API Key | - |
| `QWEN_TEXT_MODEL` | 否 | 文字翻译模型 | qwen3.5-plus |
| `QWEN_LIVE_TRANSLATE_MODEL` | 否 | 语音翻译模型 | qwen3-livetranslate-flash |
| `OSS_REGION` | 否* | OSS 区域 | oss-cn-hangzhou |
| `OSS_ACCESS_KEY_ID` | 否* | OSS AccessKey ID | - |
| `OSS_ACCESS_KEY_SECRET` | 否* | OSS AccessKey Secret | - |
| `OSS_BUCKET` | 否* | OSS Bucket 名称 | - |
| `OSS_ENDPOINT` | 否* | OSS Endpoint（外网，用于签名 URL） | - |
| `OSS_INTERNAL_ENDPOINT` | 否* | OSS Endpoint（内网，用于上传） | - |
| `OSS_USE_INTERNAL` | 否 | 是否使用内网上传（生产环境同地域设为 true） | false |
| `RTC_APP_ID` | 否* | 阿里云 RTC App ID | - |
| `RTC_APP_KEY` | 否* | 阿里云 RTC App Key | - |
| `ADMIN_USERNAME` | 否 | 初始管理员用户名 | admin |
| `ADMIN_PASSWORD` | 否 | 初始管理员密码 | Admin@12345 |
| `ADMIN_NICKNAME` | 否 | 管理员昵称 | 管理员 |

> \* OSS 和 RTC 相关变量在开发环境可不填，系统自动回退到本地存储 / 模拟模式。

---

## 数据库初始化

### 表结构

系统使用 9 张 MySQL 表：

| 表名 | 说明 | 关键索引 |
|------|------|---------|
| `users` | 用户表 | username(UNIQUE), role, status |
| `rooms` | 聊天室表 | creator_id, invite_code(UNIQUE), status |
| `room_members` | 房间成员表 | (room_id, user_id)(UNIQUE) |
| `messages` | 消息表 | (room_id, created_at), FULLTEXT(content) |
| `translations` | 翻译记录表 | (message_id, target_lang)(UNIQUE) |
| `call_sessions` | 通话会话表 | room_id, status |
| `call_participants` | 通话参与者表 | call_session_id, user_id |
| `meeting_summaries` | 会议纪要表 | (room_id, created_at), lang |
| `glossaries` | 术语表 | scope, room_id |

### 迁移命令

```bash
# 创建数据库 + 所有表
npx tsx scripts/migrate.ts

# 创建管理员账号
npx tsx scripts/seed.ts
```

---

## 启动方式

### 开发环境

```bash
# 方式一：自定义服务器（推荐，含 Socket.io）
npm run dev
# 等同于: tsx server.ts

# 方式二：Next.js 内置服务器（不含 Socket.io 实时功能）
npx next dev
```

### 生产环境

```bash
# 构建
npm run build

# 启动（PM2）
pm2 start server.ts --name rt-translate --interpreter npx -- tsx
pm2 save
```

---

## 部署指南

### Linux 宝塔面板部署

#### 1. 安装 Node.js

宝塔面板 → 软件商店 → 安装 Node.js 版本管理器 → 安装 Node.js 20.x

#### 2. 上传项目

```bash
# 上传到 /www/wwwroot/realtime-translate-chat
cd /www/wwwroot/realtime-translate-chat
npm install --production
```

#### 3. 配置环境变量

```bash
cp .env.example .env.local
vim .env.local
# 填写生产环境配置（数据库、Redis、JWT密钥、DashScope等）
```

#### 4. 初始化数据库

```bash
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts
```

#### 5. 构建

```bash
npm run build
```

#### 6. PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start server.ts --name rt-translate --interpreter npx -- tsx

# 设置开机自启
pm2 startup
pm2 save
```

#### 7. Nginx 反向代理

宝塔网站设置 → 反向代理 → 添加：

```nginx
location / {
    proxy_pass http://127.0.0.1:19716;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

> ⚠️ `proxy_read_timeout 86400` 对 Socket.io 长连接至关重要。

#### 8. HTTPS (SSL)

宝塔面板 → SSL → Let's Encrypt 申请证书 → 开启强制 HTTPS

#### 9. 阿里云服务配置

- **DashScope**: 开通服务 → 获取 API Key → 填入 `.env.local`
- **OSS**: 创建 Bucket（华东区域）→ 获取 AccessKey → 填入 `.env.local`
- **RTC**: 创建应用 → 获取 App ID → 填入 `.env.local`

### Docker 部署（可选）

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 19716
CMD ["npx", "tsx", "server.ts"]
```

```bash
docker build -t rt-translate .
docker run -d -p 19716:19716 --env-file .env.local rt-translate
```

---

## 项目结构

```
realtime-translate-chat/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # 认证页面（无需登录）
│   │   │   ├── login/               # 登录页
│   │   │   └── change-password/     # 首次改密页
│   │   ├── (main)/                  # 主界面（需登录）
│   │   │   ├── chat/                # 聊天室列表
│   │   │   │   ├── [roomId]/        # 聊天室详情
│   │   │   │   │   ├── settings/    # 房间设置
│   │   │   │   │   └── summaries/   # 会议纪要列表
│   │   │   │   └── join/[code]/     # 邀请链接加入
│   │   │   └── profile/             # 个人设置
│   │   ├── admin/                   # 管理后台
│   │   │   ├── users/               # 用户管理
│   │   │   ├── rooms/               # 聊天室管理
│   │   │   ├── glossary/            # 术语表管理
│   │   │   └── search/              # 消息检索
│   │   ├── api/v1/                  # REST API
│   │   │   ├── auth/                # 认证接口 (5)
│   │   │   ├── admin/               # 管理接口 (10)
│   │   │   ├── rooms/               # 聊天室接口 (14)
│   │   │   ├── translate/           # 翻译接口 (1)
│   │   │   ├── files/               # 文件接口 (1)
│   │   │   └── profile/             # 个人接口 (2)
│   │   ├── layout.tsx               # 根布局
│   │   ├── globals.css              # 全局样式
│   │   └── page.tsx                 # 首页重定向
│   ├── components/ui/               # UI 组件
│   │   ├── icon.tsx                 # SVG 图标库 (40+)
│   │   ├── toast.tsx                # Toast 通知
│   │   ├── avatar-crop.tsx          # 头像裁切
│   │   └── signed-image.tsx         # 签名图片
│   ├── hooks/
│   │   ├── useSocket.ts             # Socket.io Hook
│   │   └── useAuth.ts               # Token 内存管理
│   ├── lib/
│   │   ├── db.ts                    # MySQL 连接池
│   │   ├── redis.ts                 # Redis 客户端
│   │   ├── auth.ts                  # JWT 认证
│   │   ├── translate.ts             # 翻译服务
│   │   ├── oss.ts                   # 阿里云 OSS
│   │   ├── url-sign.ts              # URL 签名工具
│   │   ├── ratelimit.ts             # API 限流
│   │   ├── cookies.ts               # Cookie 动态配置
│   │   ├── fingerprint.ts           # 设备指纹
│   │   ├── fetch.ts                 # 前端 Fetch 封装
│   │   ├── errors.ts                # 错误码定义 (39个)
│   │   └── utils.ts                 # 工具函数
│   ├── socket/
│   │   └── index.ts                 # Socket.io 服务端
│   ├── types/
│   │   └── index.ts                 # TypeScript 类型
│   └── middleware.ts                # Next.js 中间件
├── scripts/
│   ├── migrate.ts                   # 数据库迁移
│   └── seed.ts                      # 初始数据
├── server.ts                        # 自定义服务器（Socket.io）
├── next.config.ts                   # Next.js 配置
├── tailwind.config.ts               # Tailwind 配置
├── tsconfig.json                    # TypeScript 配置
├── eslint.config.mjs                # ESLint 配置
├── .env.example                     # 环境变量模板
├── .gitignore
├── package.json
└── README.md
```

---

## API 接口

### 通用约定

- **Base URL**: `https://{domain}/api/v1`
- **认证**: `Authorization: Bearer {accessToken}`
- **响应格式**: JSON

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "request_id": "req_xxxxxx"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS_1001",
    "message_i18n": {
      "zh": "用户名或密码错误",
      "en": "Invalid credentials",
      "ja": "認証情報が無効です"
    }
  },
  "request_id": "req_xxxxxx"
}
```

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录 |
| POST | `/auth/logout` | 登出 |
| POST | `/auth/refresh` | 刷新 Token |
| POST | `/auth/change-password` | 修改密码 |
| GET | `/auth/me` | 获取当前用户 |
| GET | `/rooms` | 聊天室列表 |
| POST | `/rooms` | 创建聊天室 |
| GET | `/rooms/{id}` | 聊天室详情 |
| PATCH | `/rooms/{id}` | 修改聊天室 |
| POST | `/rooms/{id}/close` | 关闭聊天室 |
| POST | `/rooms/{id}/invite` | 邀请成员 |
| DELETE | `/rooms/{id}/members/{uid}` | 踢出成员 |
| GET | `/rooms/{id}/members` | 成员列表 |
| POST | `/rooms/join/{code}` | 邀请链接加入 |
| GET | `/rooms/{id}/messages` | 消息列表 |
| POST | `/rooms/{id}/messages` | 发送消息 |
| POST | `/rooms/{id}/images` | 上传图片 |
| GET | `/rooms/{id}/messages/search` | 消息搜索 |
| POST | `/translate/text` | 翻译消息 |
| POST | `/rooms/{id}/call/join` | 加入通话 |
| POST | `/rooms/{id}/call/leave` | 退出通话 |
| GET | `/rooms/{id}/call/active` | 当前通话 |
| GET | `/rooms/{id}/call/sessions` | 通话历史 |
| POST | `/rooms/{id}/summaries` | 生成纪要 |
| GET | `/rooms/{id}/summaries` | 纪要列表 |
| GET | `/summaries/{id}` | 纪要详情 |
| GET/POST | `/admin/glossary` | 全局术语 CRUD |
| GET/POST | `/admin/users` | 用户管理 |
| POST | `/admin/users/{id}/freeze` | 冻结用户 |
| POST | `/admin/users/{id}/unfreeze` | 解冻用户 |
| POST | `/admin/users/{id}/reset-password` | 重置密码 |
| GET | `/admin/rooms` | 管理员房间列表 |
| GET | `/admin/search` | 全局消息检索 |
| GET/PATCH | `/profile` | 个人信息 |
| POST | `/profile/avatar` | 上传头像 |
| POST | `/files/signed-url` | 刷新签名 URL |

### Socket.io 事件

**客户端 → 服务端：**

| 事件 | 参数 | 说明 |
|------|------|------|
| `join_room` | `{ room_id }` | 加入房间订阅 |
| `leave_room` | `{ room_id }` | 离开房间订阅 |
| `heartbeat` | - | 心跳保活 |

**服务端 → 客户端：**

| 事件 | 说明 |
|------|------|
| `message:new` | 新消息推送 |
| `call:started` | 通话开始 |
| `call:ended` | 通话结束 |
| `call:participant_joined` | 有人加入通话 |
| `call:participant_left` | 有人退出通话 |
| `subtitle:stream` | 实时字幕流 (`is_final` 区分流式/最终) |
| `user:speaking` | 发言音量回调 |
| `room:closed` | 聊天室被关闭 |
| `error` | 错误推送 |

---

## 用户角色与权限

| 操作 | 管理员 | 室长 | 成员 |
|------|:------:|:----:|:----:|
| 创建/冻结/解冻用户 | ✅ | ❌ | ❌ |
| 创建聊天室 | ✅ | ✅ | ❌ |
| 邀请/踢出成员 | ✅ | ✅(自己的房间) | ❌ |
| 发送文字/图片消息 | ✅ | ✅ | ✅ |
| 发起/加入语音通话 | ✅ | ✅ | ✅ |
| 使用翻译功能 | ✅ | ✅ | ✅ |
| 生成会议纪要 | ✅ | ✅ | ✅ |
| 维护全局术语表 | ✅ | ❌ | ❌ |
| 维护房间术语表 | ✅ | ✅(自己的房间) | ❌ |
| 查看/检索历史消息 | ✅(所有) | ✅(自己的) | ✅(自己的) |

---

## 安全设计

### JWT 双令牌机制

| 令牌 | 有效期 | 存储位置 | 用途 |
|------|--------|---------|------|
| Access Token | 2 小时 | 前端内存（变量） | API 请求鉴权 |
| Refresh Token | 7 天 | HttpOnly + Secure Cookie | 刷新 Access Token |

### 安全特性

- **密码存储**: bcrypt 哈希，salt rounds = 12
- **Cookie 安全**: 生产环境 `Secure + SameSite=Strict`，开发环境 `SameSite=Lax`
- **设备指纹**: Canvas + WebGL + UA + 屏幕等多维采集，绑定到 JWT
- **数据库重建防护**: JWT 中绑定 `issued_at_user_ts`，每次请求校验
- **强制下线**: 冻结用户 / 修改密码时，吊销所有旧 Token
- **API 限流**: 用户 200次/分，IP 500次/分，翻译 60次/分，纪要 3次/分
- **安全 Headers**: X-Content-Type-Options / X-Frame-Options / X-XSS-Protection / Referrer-Policy
- **CORS**: 仅允许指定域名

### OSS 图片安全

- 图片存储 OSS Key，不暴露 Bucket 直接 URL
- 返回前端使用签名 URL（24 小时有效）
- 前端 `<SignedImage>` 组件自动处理 403 过期刷新

---

## 性能优化

### 图片 WebP 压缩

聊天图片上传时通过 sharp 统一压缩为 WebP 格式，兼顾画质与体积：

| 参数 | 值 | 说明 |
|------|-----|------|
| 输出格式 | WebP | 浏览器原生支持，压缩率优于 JPEG/PNG |
| 质量 | 82 | 平衡画质与文件大小 |
| 最大宽高 | 2048px | `fit: 'inside'` 等比缩放，小图不放大 |

**效果参考：**

| 原始格式 | 原始大小 | 压缩后 | 体积缩减 |
|----------|----------|--------|----------|
| PNG 截图 (1920×1080) | ~3 MB | ~300 KB | ~90% |
| JPEG 照片 (4032×3024) | ~5 MB | ~400 KB | ~92% |
| GIF (静态) | ~1 MB | ~150 KB | ~85% |

头像上传同样走 WebP 转换（300×300，quality 85），前端裁切 + 服务端处理双重保障。

### OSS 内网传输

当服务器与 OSS 处于同一地域时，上传走内网 endpoint 避免流量计费：

```
OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com                    # 外网（签名 URL 给浏览器访问）
OSS_INTERNAL_ENDPOINT=http://oss-cn-beijing-internal.aliyuncs.com    # 内网（服务端上传，仅 HTTP）
```

| 操作 | 使用 Endpoint | 原因 |
|------|--------------|------|
| 文件上传 (`put`) | `OSS_INTERNAL_ENDPOINT` | 生产环境服务器 → OSS 内网传输，免流量费 |
| 签名 URL (`signatureUrl`) | `OSS_ENDPOINT` | 浏览器 → OSS 需要公网访问 |

> **开发环境**自动回退到 `OSS_ENDPOINT`（外网），因为本地机器不在阿里云 VPC 内，内网不通。仅 `NODE_ENV=production` 时启用内网上传。

---

## 常见问题

### Q: 本地开发登录后提示 Token 无效？

A: 检查 `.env.local` 中 `JWT_ACCESS_SECRET` 和 `JWT_REFRESH_SECRET` 是否已设置（至少 32 字符）。开发环境 Cookie 使用 `SameSite=Lax`（非 `Secure`），确保不是通过 HTTPS 访问 HTTP 服务。

### Q: Socket.io 连接不上？

A: 确保使用 `npm run dev`（即 `tsx server.ts`）启动，而不是 `npx next dev`。Socket.io 需要自定义 HTTP Server。

### Q: 图片上传后显示不出来？

A: 开发环境图片存在 `public/uploads/`，确保该目录可写。生产环境需配置 OSS 环境变量，否则回退到本地存储。

### Q: 翻译接口报错？

A: 检查 `DASHSCOPE_API_KEY` 是否正确。确保已开通阿里云 DashScope 服务并有足够的调用额度。

### Q: 头像上传后还是显示旧的？

A: 头像 URL 包含签名参数，24 小时过期。刷新页面会自动通过 `/api/v1/auth/me` 获取新签名 URL。如使用 OSS，检查 OSS 配置是否正确。

### Q: 数据库迁移失败？

A: 确认 MySQL 版本 >= 8.0（需要 `FULLTEXT` 索引支持），且连接账号有 `CREATE DATABASE` 权限。

### Q: 如何添加新语言支持？

A: 修改以下位置：
1. `src/types/index.ts` 中的 `LangCode` 类型
2. `src/lib/translate.ts` 中的 `langNames` 映射
3. `src/lib/errors.ts` 中的 `i18n` 翻译
4. 前端语言选择器的 `<option>` 列表

### Q: 如何从本地存储迁移到 OSS？

A: 
1. 配置 OSS 环境变量
2. 将 `public/uploads/` 下的文件手动上传到 OSS 对应路径
3. 更新数据库中 `messages.content` 和 `users.avatar_url`，将本地路径改为 OSS Key
4. 重启服务

---

## License

MIT License

---

<p align="center">
  <sub>Built with Next.js, Socket.io, Qwen, and ☕</sub>
</p>
