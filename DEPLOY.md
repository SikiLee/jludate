# 部署（云服务器）

你不需要理解“反代”。这个项目的前端容器自带 Nginx，已经配置好：

- `index.html` **不缓存**（确保更新立刻生效）
- `/assets/*` **长缓存**（文件名带 hash，安全且更快）

## 一句话发布流程（推荐）

在服务器项目目录执行：

```bash
docker compose up -d --build
```

发布后，浏览器建议 **Ctrl+F5** 强刷一次。

## 本地为什么“能热更新/免重建”

本项目默认的 `docker-compose.yml` **可直接用于生产**（不挂载 `dist`）。

仅在本地开发/应急时，可以使用自动生效的 `docker-compose.override.yml`（把 `./frontend/dist` 挂进前端容器）。  
注意：**服务器上不要放这个 override 文件**，否则可能出现“宿主机 dist 没更新但容器在跑”的假更新。

