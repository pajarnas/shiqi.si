# 上线清单

服务器：Azure for Students，`shiqi-1`，Ubuntu 24.04，`northcentralus`，公网 IP `52.162.142.136`，B2ats v2（2 vCPU / 1 GB；要换成 B2als v2，4 GB，见下面 Kafka 一节）。

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

MySQL 跑在同一台机器的 Docker Compose 里（`mysql` 服务，数据在 `mysql` 卷里），内存限制 320 MB，平时用不到 200 MB。表结构的变更写在 `apps/web/app/lib/db.server.ts` 的 `MIGRATIONS` 里，网站启动时自动执行。

密码和其他 secret 一样放在 GitHub：仓库 Settings → Environments → `production` → 加 secret `APP_MYSQL_PASSWORD`（比如 `openssl rand -hex 16` 生成一串）。部署时 CI 把它写进服务器的 `infra/server/secrets.env`，网站和 MySQL 都从那里读。MySQL 只在第一次建库时记下这个密码，之后在 GitHub 里改它没用，得先进 MySQL 改用户密码（`ALTER USER 'shiqi'@'%' IDENTIFIED BY '…'`）。没有这个 secret 时 MySQL 起不来，网站照常工作，只是不记访问。

以前存在 Redis 里的访问记录，第一次连上 MySQL 时会自动导入（Redis 里的旧列表改名成 `visits:log:imported` 留作备份）。

- 后台：<https://shiqi.si/admin/visits>，用户名随便填，密码是 `.env` 里的 `ADMIN_PASSWORD`（没设密码时这个页面是 404）。
- 后台 JSON：`curl -u admin:<密码> 'https://shiqi.si/api/admin/visits?country=CN&page=2'`
- 公开接口：<https://shiqi.si/api/visitors/countries>，只有各国人数，没有 IP；主页的世界地图用它。

在服务器上看数据（`saige@shiqi-1`）：

```bash
cd ~/shiqi.si/infra/server
docker compose exec mysql sh -c 'mysql -ushiqi -p"$MYSQL_PASSWORD" shiqi'   # 密码从 secrets.env 来
# 然后比如：SELECT country, COUNT(DISTINCT ip) FROM visits WHERE bot = 0 GROUP BY country;
```

时间默认按美东时间显示，想换就在 `.env` 里加 `ADMIN_TIME_ZONE=Asia/Shanghai`，再 `docker compose up -d web`。

以后想换成 Azure 的托管 MySQL（Azure Database for MySQL 灵活服务器），只要把 `compose.yml` 里 web 的 `MYSQL_HOST` 指过去、去掉 `mysql` 服务，代码不用动。

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

## Kafka 集群（4 GB 内存以后自动打开）

`/kafka` 的真集群是 `compose.yml` 里的 `kafka-1/2/3`：三个 KRaft 节点，每个既是 broker 也是 controller，堆 256 MB、容器上限 512 MB，只在内部网络里，不对外开端口。数据保留 24 小时或每分区 64 MB。

`deploy.sh` 每次部署都看一眼内存：`/proc/meminfo` 里 ≥ 3.5 GB 才在 `.env` 里写 `COMPOSE_PROFILES=kafka` 和 `KAFKA_BROKERS` 并启动三个节点；不够就关掉。所以把 VM 换成 `Standard_B2als_v2`（4 GB）以后，下一次部署（或手动跑一次 `deploy.sh`）就会自己起来。

```bash
az vm deallocate -g shiqi -n shiqi-1
az vm resize -g shiqi -n shiqi-1 --size Standard_B2als_v2
az vm start -g shiqi -n shiqi-1
```

检查：`curl -s https://shiqi.si/api/kafka/snapshot | head -c 300`，没开时是 503 `{"available":false}`。

接口（只读的公开，写操作要 `/admin` 的密码，而且只能动 `lab-` 开头的 topic）：

| 方法     | 路径                                                  | 作用                                                          |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `GET`    | `/api/kafka/snapshot`                                 | broker、controller、topic/分区（leader、ISR、offset）、消费组 |
| `GET`    | `/api/kafka/records?topic=&partition=&from=&limit=`   | 读一个分区的记录，最多 50 条                                  |
| `POST`   | `/api/kafka/topics` `{"name":"lab-x","partitions":3}` | 建 topic                                                      |
| `DELETE` | `/api/kafka/topics/lab-x`                             | 删 topic                                                      |
| `POST`   | `/api/kafka/produce` `{"topic":"lab-x","value":"hi"}` | 写记录（acks=all）                                            |

```bash
curl -u admin:$ADMIN_PASSWORD -H 'Content-Type: application/json' \
  -d '{"name":"lab-orders","partitions":3,"replicationFactor":3}' https://shiqi.si/api/kafka/topics
docker compose exec kafka-1 /opt/kafka/bin/kafka-metadata-quorum.sh --bootstrap-server localhost:9092 describe --status
```

本地开发直接 `docker compose up -d` 就有 Redis 和单节点 Kafka；`KAFKA_BROKERS=localhost:9092 pnpm dev` 让网站连上它。

## 从自己电脑用证书登录 Kafka 和 MySQL

服务器上有一个自建的 CA（`infra/server/certs.sh`，每次部署自动检查）。Kafka 的 TLS 端口（19094/29094/39094）和 MySQL（3306）只开在服务器的 `127.0.0.1` 上，互联网上看不到；你的电脑通过 SSH 隧道连过去，再用自己的客户端证书登录。不需要改 Azure 防火墙。

在自己电脑上，仓库根目录里：

```bash
bash infra/local/connect.sh setup saige   # 只做一次：本地生成私钥和 CSR，服务器签名，文件放在 ~/.shiqi
bash infra/local/connect.sh tunnel        # 开着这个窗口 = 隧道开着
bash infra/local/connect.sh mysql         # 另开一个窗口：MySQL 命令行（用户 saige，不用密码，只认证书）
bash infra/local/connect.sh kafka         # 打印 Kafka 命令行怎么用（brew install kafka）
```

- 私钥只在你电脑上生成，服务器只看到 CSR。证书有效期一年，到期再跑一次 `setup`。
- 默认 SSH 到 `saige@shiqi.si`；用别的密钥或地址就设 `SHIQI_SSH`，或者写进 `~/.ssh/config`。
- 签名时 MySQL 会自动加一个同名用户（对 `shiqi` 库有全部权限）并重启几秒。
- 在服务器上看发过哪些证书：`bash ~/shiqi.si/infra/server/certs.sh list`。想让所有证书作废：删掉 `infra/server/certs/ca`，再部署一次并重新 `setup`。

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
