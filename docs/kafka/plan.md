# Kafka 子项目计划

目标：打开 `/kafka`（以后 `kafka.shiqi.si`）就是一个正在运行的 Kafka 集群，能看见每条记录怎么在生产者、broker、副本和消费者之间流动；能动手弄坏它；能敲真正的 Kafka 命令；旁边是讲透每个概念的笔记。

## 架构

```
packages/kafka/       @shiqi/kafka      模拟引擎 + CLI 模拟器，不依赖任何框架
packages/kafka-viz/   @shiqi/kafka-viz  React 视图：集群舞台、分区详情、终端、面板、事件流
apps/web/app/routes/kafka.tsx           页面：把两者装进网站，加上 #kafka 笔记
apps/web/app/content/notes/commonplace/kafka-*.mdx   笔记（topics 里有 kafka 就同时出现在 /notes 和 /kafka）
```

- **引擎是确定性的**：同一个 seed 得到同一段历史，所以服务端渲染的第一帧和浏览器一致，测试也能精确断言。时间由 `tick(ms)` 推进，页面用 `requestAnimationFrame` 把真实时间 × 速度喂给它。
- **视图只读引擎的状态和事件**：`cluster.subscribe()` 通知重绘（节流到约 8 帧/秒），`cluster.onEvent()` 驱动飞行的像素方块（60 帧/秒，画在 canvas 上）。
- **文案**：`@shiqi/kafka-viz` 自带英文 `KAFKA_STRINGS`，网站在 `i18n/strings/{en,zh}.ts` 的 `kafka.lab` 里接上，其它语言由翻译服务补。CLI 的输出保持和真 Kafka 一样的英文格式。
- **为什么不跑真 Kafka**：生产 VM 只有 1 GB 内存。真 broker 的接入点是 M4 的 `ClusterApi` 适配器：同一套视图接一个后端代理，代理连本地 Docker 里的 Kafka，或者 Oracle Always Free 的 12 GB Arm 机器。

## 已经模拟的行为（M1）

| 概念       | 行为                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分区与 key | Java 客户端同款 murmur2（用 Kafka 自己的测试向量验证），无 key 用粘性分区                                                                                                                                                                                                 |
| 副本放置   | Kafka 的 rack-unaware 分配算法（leader 轮转 + follower 偏移）                                                                                                                                                                                                             |
| 复制       | follower 定时 fetch；按 `replica.lag.time.max.ms` 缩/扩 ISR；HW = ISR 中最小的 LEO                                                                                                                                                                                        |
| acks       | 0 / 1 / all；`min.insync.replicas` 不够时 `NOT_ENOUGH_REPLICAS`；超时 `REQUEST_TIMED_OUT`                                                                                                                                                                                 |
| 故障       | broker 停止 → 从 ISR 选新 leader、epoch+1；全挂 → 离线（ISR 保留最后一个）；`unclean.leader.election.enable`                                                                                                                                                              |
| 截断       | 旧 leader 回来后按 leader epoch 截掉分叉的尾巴（acks=1 丢数据看得见）                                                                                                                                                                                                     |
| 日志       | 段文件按 `segment.bytes` 滚动，文件名是 20 位偏移；`retention.ms` / `retention.bytes` 按整段删除；`compact` 保留每个 key 最新的值，墓碑在 `delete.retention.ms` 后删除                                                                                                    |
| 消费者组   | range / roundrobin / cooperative-sticky；eager 全组暂停、cooperative 只停移动的分区；会话超时；自动提交；`auto.offset.reset`；`OFFSET_OUT_OF_RANGE`                                                                                                                       |
| CLI        | `kafka-topics`、`kafka-configs`、`kafka-console-producer`、`kafka-console-consumer`、`kafka-consumer-groups`（含 `--reset-offsets`）、`kafka-leader-election`、`kafka-metadata-quorum`、`kafka-producer-perf-test`，输出格式照抄真工具；另有 `broker stop/start/slow/add` |

## 路线图

- **M1 舞台与引擎**：上面这些，加三篇笔记。
- **M2 引导课程**：一步一步的情景（“杀掉 leader 会怎样”“acks=1 为什么会丢数据”“加一个消费者触发 rebalance”“compaction 之后的偏移空洞”），每步高亮相关部件，配小测验；笔记里一键打开对应情景（`/kafka?scenario=…`）。
- **M3 更深的机制**：幂等生产者与事务（PID、序列号、`read_committed`、LSO）、`__consumer_offsets` 作为真实 topic 显示、分区重分配 `kafka-reassign-partitions`、机架感知放置、配额与限流、KRaft 控制器仲裁的选举动画、页缓存与零拷贝的“硬件层”视图。
- **M4 安全与真集群**：SSL/SASL 证书和 ACL 的模拟（一键签发证书、`kafka-acls`、认证失败长什么样）；`ClusterApi` 适配器 + 小后端代理接真的 Kafka（本地 Docker 或 Oracle Arm 机器）。
- **M5 独立出去**：`kafka.shiqi.si`（需要一条 DNS A 记录指向 52.162.142.136，再在 Caddy 里加一个站点），库拆到 GitHub 组织下的独立 repo，发 release。

## GitHub 组织和 repo 的拆分建议

组织需要你本人在 github.com 上创建（名字比如 `shiqi-si`），建好之后告诉我名字：

| repo             | 内容                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `shiqi-si/site`  | 现在这个 repo：网站、笔记、部署                                        |
| `shiqi-si/ui`    | `@shiqi/ui` 组件库 + 主题                                              |
| `shiqi-si/pixel` | `@shiqi/pixel` 像素绘图库                                              |
| `shiqi-si/kafka` | `@shiqi/kafka` 引擎 + `@shiqi/kafka-viz` 视图（一个 monorepo，两个包） |

在那之前，这些包只通过 `package.json` 的 `exports` 互相引用，不碰 `apps/web` 里的任何东西，以后拆出去只是搬目录、发包。
