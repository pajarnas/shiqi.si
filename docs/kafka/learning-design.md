# Kafka 实验室的教学设计

目标：比现有的 Kafka 可视化完整得多、也难得多，但让人学得懂、看得会。下面是做法和依据。

## 依据

| 来源                                                                                                                                                            | 拿来做什么                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kreps, Narkhede, Rao, _Kafka: a Distributed Messaging System for Log Processing_ (NetDB 2011)                                                                   | 日志即存储、页缓存而不是自己的缓存、pull 模型、分区是并行的单位、至少一次投递。broker 卡片上的 Cache 表和断电按钮就来自这里。                       |
| [KIP-101](https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation) | 两个丢数据场景：快速重启后丢掉已确认的记录、断电后副本分叉。引擎可以切换「按高水位截断（0.11 前）」和「按 leader 纪元截断」，同一个故事放两遍对比。 |
| Jack Vanlightly, [How to Lose Messages on a Kafka Cluster](https://jack-vanlightly.com/blog/2018/9/14/how-to-lose-messages-on-a-kafka-cluster-part1)            | acks=1 故障转移丢写入、不干净选举丢得更多、ISR 缩到只剩 leader 时 acks=all 也会丢，以及 min.insync.replicas=2 的建议。                              |
| [KIP-429](https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol)、KIP-848                                  | 急切式 vs 协作式重平衡；Kafka 4.0 的新消费者协议。                                                                                                  |
| Bret Victor, _Explorable Explanations_                                                                                                                          | 可交互的文档、多种表示互相联动、真实系统而不是动画片。                                                                                              |
| Mayer, 多媒体学习原则                                                                                                                                           | 分段（一步一个概念）、提示（高亮当前讲的部件）、先预测再揭晓。                                                                                      |

## 设计

1. **一切都是真的模拟。** 动画、情景和文字说明都读同一个确定性引擎：同一个 seed、同样的操作，结果一模一样。每个情景都有测试，保证文字里说会发生的事真的发生（`packages/kafka-viz/src/scenarios.test.ts`）。
2. **先猜后看。** 情景的每一步先问一个问题，锁定答案后才播放，播完再揭晓并解释原因。
3. **可以倒回去。** 所有操作都记在时间轴上，倒回就是从头重放到那一刻；在过去做操作会开出一条新的历史。每一步都有「重放这一步」。
4. **多种表示联动。** 同一个分区可以同时看：集群舞台上的像素流动、分区详情里的段文件和每个副本自己的高水位、「协议」面板里的请求时序图（Produce、Fetch、OffsetsForLeaderEpoch、JoinGroup……）、单条记录的旅程（murmur2 计算、哪些副本有它、是否已落盘、何时提交、何时确认、谁读过）。
5. **术语就地解释。** 情景文字里的术语可以悬停或点击，看到一句话的定义。
6. **偏硬件的细节。** 页缓存里还没落盘的记录画成斜纹；断电只丢页缓存里的部分；follower 落后一次拉取才知道新的高水位；分叉的记录画红框。

## 现在有的情景

基础：一条记录的一生。持久性：acks=1 丢写入、acks=all 只和 ISR 一样可靠、不干净选举。KIP-101：重启丢记录（0.10 / 0.11+）、断电分叉（0.10 / 0.11+）。消费者组：急切式 vs 协作式、崩溃 vs 正常离开（重复处理）。Key 与日志：key 和顺序（含加分区、闲置消费者）、保留与压缩。

链接形如 `/kafka?scenario=acks-one`，笔记里的「Try it」都指向这些情景。
