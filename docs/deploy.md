# 上线清单

服务器：Azure for Students，`shiqi-1`，Ubuntu 24.04，`northcentralus`，公网 IP `52.162.142.136`，B2ats v2（2 vCPU / 1 GB）。

```
浏览器 ──HTTPS──▶ Caddy（自动申请、续期 Let's Encrypt 证书）
                     ──▶ web（React Router, Node） ──▶ redis
全部由 Docker Compose 管理（infra/server/compose.yml）
```

1 GB 内存跑不动 k3s（实测会把机器拖死），所以这台机器用 Docker Compose。
k8s 清单和 `infra/k8s/bootstrap-k3s.sh` 留着，等有 2 GB 以上的机器（比如 Oracle 免费 Arm）再用。

## 1. DNS（在域名注册商后台）

| 类型 | 主机  | 值               |
| ---- | ----- | ---------------- |
| A    | `@`   | `52.162.142.136` |
| A    | `www` | `52.162.142.136` |

检查：`dig +short shiqi.si` 返回这个 IP。

## 2. GitHub 仓库

1. 新建仓库 `shiqi.si`（公开的话镜像也公开，服务器拉取不用凭证）。
2. 推代码：

   ```bash
   cd ~/projects/shiqi.si
   git init -b main   # 已经是 git 仓库就跳过
   git add -A && git commit -m "Initial site"
   git remote add origin git@github.com:<你的用户名>/shiqi.si.git
   git push -u origin main
   ```

3. 等 Actions 里的 **CI** 跑完：会生成镜像 `ghcr.io/<你的用户名>/shiqi.si`。
4. 如果仓库是私有的：在 GitHub 的 Packages 页面把 `shiqi.si` 包改成 Public，或者在服务器上 `docker login ghcr.io`。

## 3. 初始化服务器（只做一次）

```bash
ssh saige@52.162.142.136
git clone https://github.com/<你的用户名>/shiqi.si.git && cd shiqi.si   # 必须克隆到 ~/shiqi.si，CI 部署会用这个路径
ACME_EMAIL=<你的邮箱> GITHUB_OWNER=<你的用户名> bash infra/bootstrap.sh
```

脚本会：加 2 GB swap、开自动安全更新、装 Docker、用 Docker Compose 启动网站、Redis 和 Caddy。

检查：

```bash
cd ~/shiqi.si/infra/server && docker compose ps
curl -I https://shiqi.si
```

DNS 生效后，第一次访问时 Caddy 就会去拿证书。拿不到时查日志：`docker compose logs caddy`。

## 4. 打开自动部署

1. 在服务器上生成一把专门给 CI 用的密钥：

   ```bash
   ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy' -f ~/.ssh/deploy
   cat ~/.ssh/deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/deploy        # 私钥，下一步填进 GitHub
   rm ~/.ssh/deploy         # 填完就删
   ```

2. GitHub 仓库 → Settings → Environments → 新建 `production`，加 Secrets：
   - `DEPLOY_HOST` = `52.162.142.136`
   - `DEPLOY_USER` = `saige`
   - `DEPLOY_SSH_KEY` = 上面的私钥
   - `DEPLOY_KNOWN_HOSTS` = 在 Mac 上运行 `ssh-keyscan 52.162.142.136` 的输出
3. Settings → Variables → 加 `DEPLOY_ENABLED` = `true`。

之后每次推到 `main`：检查 → 构建镜像 → 自动滚动更新。

## 5. 打开翻译服务（可选）

笔记用英文写，中文版由 Claude 翻译。在 [console.anthropic.com](https://console.anthropic.com) 建一个 API key，然后在服务器上：

```bash
cd ~/shiqi.si/infra/server
umask 077 && echo 'ANTHROPIC_API_KEY=sk-ant-...' >> secrets.env
docker compose up -d web
```

`secrets.env` 不在 git 里，`bootstrap.sh` 也不会覆盖它。翻译结果缓存在 Redis，每段文字只翻一次；没有 key 时中文访客看到英文原文。

## 以后：Kafka

Kafka 需要约 1 GB 内存，1 GB 的机器放不下。等有更大的节点（比如 Oracle Cloud 免费的 Arm 机器），在那台机器上：

```bash
ACME_EMAIL=<你的邮箱> GITHUB_OWNER=<你的用户名> bash infra/k8s/bootstrap-k3s.sh
kubectl apply -k infra/k8s/addons/kafka
```

本地开发直接 `docker compose up -d` 就有 Redis 和 Kafka。

## 常用运维

在服务器上，先 `cd ~/shiqi.si/infra/server`：

```bash
docker compose ps                          # 看状态
docker compose logs -f web                 # 看日志
docker compose restart web                 # 重启
bash ~/shiqi.si/infra/deploy.sh <镜像>     # 换到某个版本（回滚也用它）
docker compose exec redis redis-cli        # 进 Redis
free -h                                    # 看内存
```
