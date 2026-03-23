# SZUDate

SZUDate 是校园恋爱匹配平台（默认品牌名，可在管理端改名为 THUDate 等）。当前版本已实现 ROSE 50 题评分、四维人格判型、硬性过滤、加权匹配、互补加分、每周二 21:00 自动派发和匹配邮件通知，并支持站点品牌/邮箱域名白名单/首页背景图配置。邮件通道已切换为标准 SMTP 认证服务（企业邮箱/QQ/SendGrid），不再使用 Mailpit。

## How to Run (一键启动命令)

项目支持无人值守启动：

```bash
docker compose up --build -d
```

停止服务：

```bash
docker compose down
```

## Services List (服务地址)

| 服务 | 端口 | 地址 | 说明 |
| --- | --- | --- | --- |
| Frontend | `8383` | [http://localhost:8383](http://localhost:8383) | 用户端页面（注册、问卷、匹配结果） |
| Backend API | `8000` | [http://localhost:8000/health](http://localhost:8000/health) | Next.js API 服务 |
| PostgreSQL | `5433` | `localhost:5433` | 双库模式：`identity_db`（身份）+`survey_db`（问卷）自动初始化 |

## SMTP 配置（企业邮箱 / QQ / SendGrid）

在执行 `docker compose up --build -d` 之前，先准备 SMTP 环境变量（可放在 shell 环境或根目录 `.env`）。

- 通用必填项：
  - `SMTP_ENABLED=true`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`（`465` 通常为 `true`；`587` 通常为 `false`）
  - `SMTP_USER`
  - `SMTP_PASS`（通常为授权码/API Key，不是登录密码）
  - `SMTP_FROM`（发件地址）

- 示例 1：QQ 邮箱 SMTP

```bash
export SMTP_ENABLED=true
export SMTP_HOST=smtp.qq.com
export SMTP_PORT=465
export SMTP_SECURE=true
export SMTP_USER=your_account@qq.com
export SMTP_PASS=your_qq_smtp_auth_code
export SMTP_FROM=your_account@qq.com
docker compose up --build -d
```

- 示例 2：SendGrid SMTP

```bash
export SMTP_ENABLED=true
export SMTP_HOST=smtp.sendgrid.net
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=apikey
export SMTP_PASS=SG.xxxxxx
export SMTP_FROM=no-reply@yourdomain.com
docker compose up --build -d
```

- 示例 3：企业邮箱（如腾讯企业邮/Outlook/Google Workspace）

```bash
export SMTP_ENABLED=true
export SMTP_HOST=smtp.your-company.com
export SMTP_PORT=587
export SMTP_SECURE=false
export SMTP_USER=no-reply@your-company.com
export SMTP_PASS=your_smtp_password_or_app_password
export SMTP_FROM=no-reply@your-company.com
docker compose up --build -d
```

## Verification (验证方法)

1. 打开前端页面 `http://localhost:8383`，进入注册页。
2. 使用两个白名单域名邮箱注册（默认示例：`user_a@szu.edu.cn`、`user_b@szu.edu.cn`）。
3. 点击“获取验证码”，到你配置的 SMTP 邮箱收件箱获取验证码完成注册。
4. 登录后先完成问卷前基础信息（我的性别 + 对象性别），再开始 50 题 ROSE 问卷（按部分翻页作答）。
5. 提交最后一部分后会立即展示你的 ROSE 类型。
6. 页面会展示数据库中的类型解读（摘要 + 可展开全文）。
7. 进入匹配页：
   - 正式流程：每周二 21:00（Asia/Shanghai）自动派发；
   - 测试流程：登录后点击“测试触发匹配”调用 `/api/match/trigger`（需后端启用 `ALLOW_TEST_TRIGGER=true`）。
8. 匹配成功后可在页面看到：匹配度、双方 ROSE 码、致命契合点、派发时间；未匹配时也会显示你的 ROSE 类型；匹配邮件会通过你配置的 SMTP 服务发送。

## Admin (类型解读管理)

1. 首次将某个账号设为管理员（示例）：
```bash
docker compose exec db psql -U user -d identity_db -c "UPDATE szudate_app.users SET is_admin = TRUE WHERE email = 'your_admin@szu.edu.cn';"
```
2. 该账号重新登录后访问：
   - 前端管理页：`http://localhost:8383/admin`
3. 管理接口（需管理员 Token）：
   - `GET /api/admin/rose-types`
   - `GET /api/admin/rose-types/:code`
   - `PUT /api/admin/rose-types/:code`
   - `GET /api/admin/site-settings`
   - `PUT /api/admin/site-settings`
   - `POST /api/admin/site-settings/home-hero-background`
   - `DELETE /api/admin/site-settings/home-hero-background`
   - `GET /api/admin/survey-questions`
   - `GET /api/admin/survey-questions/:number`
   - `PUT /api/admin/survey-questions/:number`
   - `POST /api/admin/survey-questions/import`
4. 题目配置管理页：
   - 问卷页会从 `GET /api/survey/questions` 动态读取题目配置（文案/分组/顺序）。
5. 站点配置管理页（同一后台 Tab）：
   - 可修改 `brand_name`、`allowed_email_domains`（多域名白名单）；
   - 可修改首页“为什么选择我们”卡片（图标/标题/描述）；
   - 可配置首页 `FAQ`（问题/答案，支持增删改，保存即生效）；
   - 可上传/删除首页背景图；
   - 用户端读取公开配置：`GET /api/public/site-settings`。
6. 类型解读采用纯数据库模式：
   - 系统首次启动时，若解读表为空，会自动从 `Type.md` 导入 16 型解读到数据库；
   - 若未找到 `Type.md`，会回退初始化 16 型占位内容；
   - 后续仅通过管理端编辑并保存（保存即生效）；
   - `Type.md` 不再作为运行时数据源。

## Automated Tests

根目录执行：

```bash
./run_tests.sh
```

脚本会自动执行：
- ROSE 单元测试（`unit_tests/`）
- 前后端构建
- `docker compose` 启动与健康检查
- API 端到端测试（`API_tests/`，通过测试开关返回验证码，不依赖 Mailpit）
- 最终输出 `Total / Passed / Failed` 汇总
