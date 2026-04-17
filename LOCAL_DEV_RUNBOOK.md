# 本地网站跑通命令手册（Windows / PowerShell）

本文档用于快速在本地跑通前后端，并完成管理员登录与后台接口自检。

## 1) 启动前检查

在项目根目录执行（`jludate-main`）：

```powershell
cd "C:\Users\Administrator\Desktop\jludate\jludate-main"
```

确认后端使用的环境文件是 `backend/.env.local`，并包含以下关键项：

```env
ENABLE_DEFAULT_USERS_BOOTSTRAP=true
DEFAULT_ADMIN_EMAIL=admin@mails.jlu.edu.cn
DEFAULT_ADMIN_PASSWORD=9sK7!qZ58bG8
RATE_LIMIT_ENABLED=false
```

## 2) 安装依赖（首次）

```powershell
cd ".\backend"
npm install

cd "..\frontend"
npm install
```

## 3) 启动后端（端口 8000）

新开一个 PowerShell 窗口：

```powershell
cd "C:\Users\Administrator\Desktop\jludate\jludate-main\backend"
npm run dev
```

后端地址：`http://127.0.0.1:8000`

## 4) 启动前端（端口 3000）

再开一个 PowerShell 窗口：

```powershell
cd "C:\Users\Administrator\Desktop\jludate\jludate-main\frontend"
npm run dev
```

前端地址：`http://127.0.0.1:3000`

## 5) 浏览器登录

- 登录页：`http://127.0.0.1:3000/auth`
- 管理员账号：`admin@mails.jlu.edu.cn`
- 管理员密码：`9sK7!qZ58bG8`

## 6) 一条命令验证“登录 + 管理员接口”

在后端目录执行：

```powershell
cd "C:\Users\Administrator\Desktop\jludate\jludate-main\backend"
$body = @{ email = 'admin@mails.jlu.edu.cn'; password = '9sK7!qZ58bG8' } | ConvertTo-Json
$login = Invoke-RestMethod -TimeoutSec 20 -Uri 'http://127.0.0.1:8000/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
$token = $login.data.access_token
$admin = Invoke-RestMethod -TimeoutSec 20 -Uri 'http://127.0.0.1:8000/api/admin/match-questionnaire/config?type=love' -Headers @{ Authorization = "Bearer $token" }
"login_code=$($login.code) admin_code=$($admin.code) is_admin=$($login.data.is_admin)"
```

预期输出：

```text
login_code=200 admin_code=200 is_admin=True
```

## 7) 常见故障与处理

### A. 登录返回 400 Invalid credentials

优先检查 `backend/.env.local` 中 `DEFAULT_ADMIN_PASSWORD` 是否与你输入一致。  
修改后重启后端 `npm run dev`。

### B. 登录返回 429 Too Many Requests

本地开发可在 `backend/.env.local` 设置：

```env
RATE_LIMIT_ENABLED=false
```

然后重启后端。

### C. 后端启动失败：`EADDRINUSE: 8000`

```powershell
netstat -ano | Select-String ":8000"
taskkill /PID <占用8000端口的PID> /F
```

再执行 `npm run dev`。

### D. 前端页面仍提示未登录/权限不足

清理浏览器本地存储后重试：

- DevTools -> Application -> Local Storage -> `http://127.0.0.1:3000` -> 清空
- 刷新页面重新登录

## 8) 最小可用流程（速记）

```powershell
# 终端1
cd "C:\Users\Administrator\Desktop\jludate\jludate-main\backend"
npm run dev

# 终端2
cd "C:\Users\Administrator\Desktop\jludate\jludate-main\frontend"
npm run dev
```

浏览器打开 `http://127.0.0.1:3000/auth`，使用管理员账号登录即可。
