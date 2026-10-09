# 上线清单

服务器：Azure for Students，`shiqi-1`，Ubuntu 24.04，`northcentralus`，公网 IP `52.162.142.136`，B2ats v2（2 vCPU / 1 GB）。

```
浏览器 ──HTTPS──▶ Traefik（k3s 自带） ──▶ web（React Router, Node） ──▶ redis
                     ▲
              cert-manager（Let's Encrypt 自动签发、续期）
```

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
4. 如果仓库是私有的：在 GitHub 的 Packages 页面把 `shiqi.si` 包改成 Public，或者在集群里配 `imagePullSecret`。

## 3. 初始化服务器（只做一次）

```bash
ssh saige@52.162.142.136
git clone https://github.com/<你的用户名>/shiqi.si.git && cd shiqi.si
ACME_EMAIL=<你的邮箱> GITHUB_OWNER=<你的用户名> bash infra/bootstrap.sh
```

脚本会：加 2 GB swap、开自动安全更新、装 k3s、装 cert-manager 和 Let's Encrypt issuer、部署网站和 Redis。

检查：

```bash
kubectl -n shiqi get pods,ingress,certificate
curl -I https://shiqi.si
```

证书一般一两分钟变成 `READY=True`。前提是第 1 步的 DNS 已经生效。

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

## 以后：Kafka

Kafka 需要约 1 GB 内存，1 GB 的机器放不下。等有更大的节点（比如 Oracle Cloud 免费的 Arm 机器）：

```bash
kubectl apply -k infra/k8s/addons/kafka
```

本地开发直接 `docker compose up -d` 就有 Redis 和 Kafka。

## 常用运维

```bash
kubectl -n shiqi logs deploy/web -f            # 看日志
kubectl -n shiqi rollout restart deploy/web    # 重启
kubectl -n shiqi rollout undo deploy/web       # 回滚到上一个版本
kubectl -n shiqi exec -it redis-0 -- redis-cli # 进 Redis
```
