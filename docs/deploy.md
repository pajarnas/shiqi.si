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

## 访客记录（MySQL）

每次打开页面（包括站内跳转），网站会在 MySQL 的 `visits` 表里记一行：时间、IP、国家、页面、浏览器、来源、是不是爬虫。IP 取自 Caddy 加的 `X-Forwarded-For`，Caddy 会丢掉客户端自己伪造的那份；国家用 IP 查询服务查出来，结果在 Redis 里缓存 7 天。

MySQL 跑在同一台机器的 Docker Compose 里（`mysql` 服务，数据在 `mysql` 卷里），内存限制 320 MB，平时用不到 200 MB。密码由 `infra/server/ensure-env.sh` 第一次部署时生成，写进 `.env` 的 `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD`，之后不会再改。表结构的变更写在 `apps/web/app/lib/db.server.ts` 的 `MIGRATIONS` 里，网站启动时自动执行。

以前存在 Redis 里的访问记录，第一次连上 MySQL 时会自动导入（Redis 里的旧列表改名成 `visits:log:imported` 留作备份）。

- 后台：<https://shiqi.si/admin/visits>，用户名随便填，密码是 `.env` 里的 `ADMIN_PASSWORD`（没设密码时这个页面是 404）。
- 后台 JSON：`curl -u admin:<密码> 'https://shiqi.si/api/admin/visits?country=CN&page=2'`
- 公开接口：<https://shiqi.si/api/visitors/countries>，只有各国人数，没有 IP；主页的世界地图用它。

在服务器上看数据（`saige@shiqi-1`）：

```bash
cd ~/shiqi.si/infra/server
docker compose exec mysql sh -c 'mysql -ushiqi -p"$MYSQL_PASSWORD" shiqi'
# 然后比如：SELECT country, COUNT(DISTINCT ip) FROM visits WHERE bot = 0 GROUP BY country;
```

时间默认按美东时间显示，想换就在 `.env` 里加 `ADMIN_TIME_ZONE=Asia/Shanghai`，再 `docker compose up -d web`。

以后想换成 Azure 的托管 MySQL（Azure Database for MySQL 灵活服务器），只要把 `compose.yml` 里 web 的 `MYSQL_URL` 指过去、去掉 `mysql` 服务，代码不用动。

## 5. 打开翻译服务（可选）

笔记用英文写，中文版由 Azure AI Translator 的免费档（F0，每月 200 万字符，不收费）翻译。

在 Azure Cloud Shell（`szhang3035 [ ~ ]$`）里建资源、拿 key：

```bash
az cognitiveservices account create -n shiqi-translator -g shiqi \
  --kind TextTranslation --sku F0 -l global --yes
az cognitiveservices account keys list -n shiqi-translator -g shiqi --query key1 -o tsv
```

（`-l global` 被学生订阅拒绝的话，换成 `-l northcentralus`，再多加一个 secret `APP_AZURE_TRANSLATOR_REGION`，值 `northcentralus`。）

然后把 key 存进 GitHub Secrets（加密保存，不进代码；仓库是公开的，key 绝不能写进任何文件）：
仓库 → Settings → Environments → `production` → Add environment secret，名字 `APP_AZURE_TRANSLATOR_KEY`，值填 key。

每次部署时，CI 会把所有 `APP_` 开头的 secret 去掉前缀，通过 SSH 的标准输入写进服务器的
`infra/server/secrets.env`（只替换同名的那一行，其余保留），再重启 web。以后加别的 key 也一样，
只要加一个 `APP_<名字>` 的 secret，不用改代码。存好后在 Actions 里重新跑一次最新的 CI，或者等下一次 push。

没开 CI 自动部署的话，也可以直接在服务器（`saige@shiqi-1`）上写：

```bash
cd ~/shiqi.si/infra/server
umask 077 && echo 'AZURE_TRANSLATOR_KEY=<key>' >> secrets.env
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
