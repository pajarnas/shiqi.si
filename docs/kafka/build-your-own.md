# 从零写一个 Kafka：课程设计

目标：学完之后觉得 Kafka 就是自己写的。每一个机制都从「没有它会出什么事」讲起，自己写出最小可用的那一版，看它在活的集群里跑起来，再亲手把它弄坏，最后对照 Kafka 真正的源码和 KIP。

这是 M3 的计划，取代原来的「更深的机制」清单。原清单里的东西（幂等、事务、`__consumer_offsets`、KRaft、零拷贝）都变成下面的章节。

## 每一章的五步

1. **问题。** 先用上一章写好的系统跑一个具体场景，看它在哪里坏掉。比如只有一个文件的日志，按偏移读要从头扫，读第 100 万条要等好几秒，屏幕上能看见扫描的进度。
2. **设计。** 给出两三种做法让读者先猜：「每条记录都建索引，还是每 4 KB 建一条？」锁定答案后再用模拟器把两种都跑一遍，对比内存和查找次数。
3. **自己写。** 页面上有一个小编辑器，只写一个函数，通常 10 到 40 行，比如 `lookup(index, offset)`、`highWatermark(isr)`、`assign(members, partitions)`。旁边的测试实时变绿。写好的函数会直接替换引擎里对应的那一块，集群就跑在你的代码上。卡住了可以看提示，最后也可以看参考答案。
4. **弄坏它。** 每章都有专门的破坏按钮，比如断电、拔网线、让一个副本变慢、让两个消费者同时以为自己拥有同一个分区。你的实现和 Kafka 的实现并排跑，看谁先出事。
5. **对照真 Kafka。** 每章最后指出 `apache/kafka` 里对应的类和方法（例如 `OffsetIndex.lookup`、`Partition.maybeIncrementLeaderHW`、`RangeAssignor`），以及引入它的 KIP。读者会发现自己写的和 Kafka 的是同一个形状。

## 章节

| #   | 章                      | 问题                                        | 你写的函数                                         | 弄坏它                                       | 对照                                                           |
| --- | ----------------------- | ------------------------------------------- | -------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| 0   | 为什么是日志            | 队列读完就没了，第二个消费者看不到          | 无（体验：队列 vs 日志）                           | 消费者落后、重读                             | Kreps《The Log》                                               |
| 1   | 一个追加写的文件        | 记录在磁盘上长什么样，怎么知道一条写完整了  | `encodeRecord`：varint 长度 + CRC32C 的记录批      | 写一半断电，读出半条记录                     | `DefaultRecordBatch`、KIP-98 消息格式 v2                       |
| 2   | 偏移和索引              | 按偏移读要从头扫                            | `lookup`：稀疏索引上的二分查找                     | 索引损坏，启动时重建                         | `OffsetIndex`、`TimeIndex`                                     |
| 3   | 段和保留                | 文件无限长，旧数据删不掉                    | `segmentsToDelete`：按时间、按大小                 | 消费者还在读的段被删 → `OFFSET_OUT_OF_RANGE` | `UnifiedLog`、`LogSegment`                                     |
| 4   | 页缓存、落盘和零拷贝    | 每条都 fsync 太慢，不 fsync 又会丢          | `shouldFlush`：间隔、条数                          | 断电只丢页缓存里的部分                       | `log.flush.interval.*`、`sendfile`                             |
| 5   | 压缩                    | 只关心每个 key 的最新值时，日志还是会无限长 | `compact`：保留每个 key 最后一条，墓碑延迟删除     | 墓碑删太早，消费者看不到删除                 | `LogCleaner`                                                   |
| 6   | 分区和 key              | 一个日志只能在一台机器上，顺序只在分区内    | `partition`：murmur2 取正再取模                    | 加分区后同一个 key 换了分区                  | `BuiltInPartitioner`、KIP-794                                  |
| 7   | 生产者：批和幂等        | 一条一条发太慢；重试会写重复                | `accept`：按 PID 和序列号去重                      | 网络把确认吃掉，生产者重发                   | `ProducerStateManager`、KIP-98                                 |
| 8   | 复制和高水位            | 一台机器坏了数据就没了                      | `highWatermark`：ISR 里最小的拉取偏移              | follower 落后一轮才知道 HW                   | `Partition.maybeIncrementLeaderHW`                             |
| 9   | ISR、acks 和 min.insync | 等所有副本太慢，不等又会丢                  | `shouldShrinkIsr`、`canAck`                        | acks=1 故障转移、ISR 只剩 leader             | `replica.lag.time.max.ms`、Vanlightly 的测试                   |
| 10  | 选举和 leader 纪元      | 旧 leader 回来后两边的日志分叉              | `endOffsetForEpoch`、`truncationPoint`             | KIP-101 的两个场景                           | `LeaderEpochFileCache`、KIP-101、KIP-279                       |
| 11  | 控制器和 KRaft          | 谁来决定谁是 leader？决定者自己也会挂       | `grantVote`：Raft 的投票规则                       | 脑裂、旧控制器的写入被纪元挡掉               | `QuorumController`、KIP-500、KIP-595、Raft 论文                |
| 12  | 消费者组                | 多个消费者怎么分分区，有人挂了怎么办        | `assign`：range 和 sticky                          | 急切式重平衡全组停顿、僵尸消费者             | `RangeAssignor`、`CooperativeStickyAssignor`、KIP-429、KIP-848 |
| 13  | 提交偏移                | 消费者重启后从哪里读                        | 无，复用第 5 章：`__consumer_offsets` 是压缩 topic | 先提交后处理丢消息，先处理后提交重复         | `GroupMetadataManager`                                         |
| 14  | 事务和精确一次          | 读-处理-写，中途崩溃会写一半                | `lastStableOffset`：未完成事务的最小起点           | 生产者在提交前崩溃，`read_committed` 被挡住  | `TransactionCoordinator`、KIP-98、KIP-447                      |

章节可以单独打开，但默认按顺序走：每一章都用前面几章你自己写的代码。学完第 14 章，屏幕上的集群从字节格式、索引、复制、选举到事务，每一块都是你写的。

## 怎么做

- **章节正文是笔记。** 每章是一篇 MDX 笔记（topics 里有 `kafka`，`series: build-kafka`），所以同时出现在 `/notes` 和 `/kafka/build/<章>`，符合「笔记可复用」的要求。正文里嵌三种组件：`<Lab>`（一个小集群或者一个日志文件的可视化）、`<Exercise>`（编辑器加测试）和 `<Break>`（破坏按钮）。
- **引擎可插拔。** 引擎里每个可以让读者写的地方都抽成一个策略接口，比如 `partitioner`、`indexLookup`、`highWatermark`、`grantVote` 和 `assignor`。参考实现就是现在引擎里的代码，搬出来之后行为不变，已有的测试和情景都能证明这一点。读者的实现走同一个接口。
- **代码在浏览器里跑。** 读者写 TypeScript，用 sucrase 去掉类型（不做类型检查，体积小），放进 Web Worker 里跑，超时就终止，死循环不会卡住页面。测试结果和替换后的集群行为都来自同一个 Worker。代码存在 `localStorage`，不上传。
- **字节层面的视图。** 第 1 到 4 章需要一个新的「文件视图」：十六进制加注解，像 Wireshark 那样点一个字段，高亮对应的字节；段文件、`.index`、`.timeindex` 并排显示；页缓存和磁盘分成两条带子。
- **真集群对照。** 第 8 到 12 章可以切到真 Kafka（另一个对话正在部署的 3 节点集群），用同样的视图看真 broker 的状态，验证模拟里学到的东西。
- **文案**：都在 `@shiqi/kafka-viz` 的字符串文件里，中文翻译放在网站的 `zh.ts`。正文是英文笔记，中文由翻译服务补。

## 先后顺序

1. **基础设施**：
   - 策略接口：现在的行为都搬进参考实现。
   - `<Exercise>`：编辑器、Worker、测试面板。
   - `/kafka/build` 目录页。
2. **第 0 到 4 章**：存储层，包括文件视图。这几章最能体现「从底层讲透」，也最能拉开和现有教程的差距。
3. **第 5 到 10 章**：分区、生产者和复制。大部分机制引擎里已经有了，主要是写课文和练习。
4. **第 11 到 14 章**：KRaft 和事务，需要新的引擎部分：Raft 投票和元数据日志、事务协调者和 LSO。

每一批单独发一个 PR，做完就上线。

## 参考

- Jay Kreps, [The Log: What every software engineer should know about real-time data's unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
- Kreps, Narkhede, Rao, _Kafka: a Distributed Messaging System for Log Processing_ (NetDB 2011)
- Wang et al., _Building a Replicated Logging System with Apache Kafka_ (VLDB 2015)
- Ongaro, Ousterhout, _In Search of an Understandable Consensus Algorithm_ (Raft, USENIX ATC 2014)
- [Kafka 设计文档](https://kafka.apache.org/documentation/#design)
- [KIP-98](https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging)（幂等和事务）、KIP-101 和 KIP-279（leader 纪元）、[KIP-500](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum) 和 KIP-595（KRaft）、KIP-429 和 KIP-848（重平衡）、KIP-447（消费者组的精确一次）
- Jack Vanlightly 关于 Kafka 复制协议和 TLA+ 规约的文章
- Crafting Interpreters、Build Your Own X 这类「自己写一遍」的教程，参考它们的节奏：每一步都能跑。
