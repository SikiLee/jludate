# 配吉友 | JluDate
受斯坦福大学 DateDrop 和上海交大 SJTUDate 的启发，我们打造了“配吉友”。  
我们希望过滤掉世俗的喧嚣，将交友拉回纯粹的智性圈层，为你寻找浩瀚人海中的那道唯一正解。  
当前版本已实现 ROSE 50 题评分、四维人格判型、加权匹配、互补加分、每周五 20:00 自动派发、站内匹配会话和匹配邮件通知（邮件默认仅提醒去站内查看详情），并支持站点品牌/邮箱域名白名单/首页背景图配置。


## How to Run (一键启动命令)

先准备环境变量：

```bash
cp .env.example .env
```

必须配置（否则后端不会启动）：
- `SECRET_KEY`
- `PRIVACY_KEYRING_JSON`

可选配置：
- `DEFAULT_ALLOWED_EMAIL_DOMAINS`：站点白名单域名默认值（仅在 `site_settings` 未初始化时生效），支持逗号/换行或 JSON 数组。
- `WEB_BASE_URL`：邮件模板中的 `{{match_url}}` 生成基地址，默认 `http://localhost:8383`。

然后启动服务：

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

- 示例 1：网易邮箱 SMTP

```bash
export SMTP_ENABLED=true
export SMTP_HOST=smtp.163.com
export SMTP_PORT=465
export SMTP_SECURE=true
export SMTP_USER=your_account@163.com
export SMTP_PASS=your_netease_smtp_auth_code
export SMTP_FROM=your_account@163.com
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
2. 使用两个白名单域名邮箱注册（默认示例：`user_a@mails.jlu.edu.cn`、`user_b@mails.jlu.edu.cn`）。
3. 点击“获取验证码”，到你配置的 SMTP 邮箱收件箱获取验证码完成注册。
   - 若忘记密码：在登录页点击“忘记密码？”，输入邮箱并获取重置验证码，再设置新密码登录。
4. 登录后先完成问卷前基础信息（我的性别 + 对象性别），再开始 50 题 ROSE 问卷（按部分翻页作答）。
5. 提交最后一部分后会立即展示你的 ROSE 类型。
6. 页面会展示数据库中的类型解读（摘要 + 可展开全文）。
7. 进入匹配页：
   - 正式流程：每周五 20:00（Asia/Shanghai）自动派发；
   - 测试流程：登录后点击“测试触发匹配”调用 `/api/match/trigger`（需后端启用 `ALLOW_TEST_TRIGGER=true`）。
8. 匹配成功后可在页面看到：匹配度、双方 ROSE 码、四维匹配理由、派发时间，并可在站内对话框与对方沟通；未匹配时也会显示你的 ROSE 类型；匹配邮件会通过你配置的 SMTP 服务发送。

## Admin (类型解读管理)

1. 默认不自动创建任何管理员/普通用户（`ENABLE_DEFAULT_USERS_BOOTSTRAP=false`）。
2. 若确需初始化测试账号，可显式开启（不建议生产环境启用）：
```bash
export ENABLE_DEFAULT_USERS_BOOTSTRAP=true
export DEFAULT_ADMIN_EMAIL=admin@your-school.edu.cn
export DEFAULT_ADMIN_PASSWORD=ChangeMe_StrongPassword
export DEFAULT_USER_EMAIL=user@your-school.edu.cn
export DEFAULT_USER_PASSWORD=ChangeMe_UserPassword
docker compose up --build -d
```
3. 注意：管理员邮箱域名必须在站点白名单 `allowed_email_domains` 内，否则登录会被拒绝。
4. `DEFAULT_USER_EMAIL` 必须与 `DEFAULT_ADMIN_EMAIL` 不同。
5. 管理员账号登录后访问：
   - 前端管理页：`http://localhost:8383/admin`
6. 管理接口（需管理员 Token）：
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
7. 题目配置管理页：
   - 问卷页会从 `GET /api/survey/questions` 动态读取题目配置（文案/分组/顺序）。
8. 站点配置管理页（同一后台 Tab）：
   - 可修改 `brand_name`、`allowed_email_domains`（多域名白名单，支持通配规则如 `*.edu.cn`）；
   - 初始 `allowed_email_domains` 默认值可通过 `DEFAULT_ALLOWED_EMAIL_DOMAINS` 配置；
   - 可一键配置首页三项统计（已注册用户 / 问卷完成率 / 成功配对人数）是否公开显示；
   - 可修改首页“为什么选择我们”卡片（图标/标题/描述）；
   - 可配置首页 `FAQ`（问题/答案，支持增删改，保存即生效）；
   - 可上传/删除首页背景图；
   - 用户端读取公开配置：`GET /api/public/site-settings`。
9. 类型解读采用纯数据库模式：
   - 系统首次启动时，若解读表为空，会自动从 `Type.md` 导入 16 型解读到数据库；
   - 若未找到 `Type.md`，会回退初始化 16 型占位内容；
   - 后续仅通过管理端编辑并保存（保存即生效）；
   - `Type.md` 不再作为运行时数据源。

## Open Source Docs

- 许可证：`CC BY-NC 4.0`（禁止商业使用，见 `LICENSE`）
- 贡献指南：`CONTRIBUTING.md`


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

## Type.md 

- `Type.md`：16 种 ROSE 恋爱人格解读内容的源文档。系统首次启动且数据库解读表为空时，会从该文件导入；导入后运行时以数据库为准，后续可在管理端编辑。