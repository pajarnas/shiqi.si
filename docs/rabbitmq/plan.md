# RabbitMQ lab: plan

The RabbitMQ lab at `/rabbitmq` mirrors the Kafka lab: a deterministic broker
simulation, a live stage, guided stories that are tested against their own
text, a terminal, and notes under `notes/commonplace/rabbitmq/`.

## Packages

| Package               | What it holds                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@shiqi/sim`          | Shared by every lab: fixed-step `Simulation`, record/replay `Timeline`, story `BeatFilter`, CLI helpers, React hooks |
| `@shiqi/lab`          | Shared lab frame: toolbar, scenario player and menu, story, event list, panels, forms, glossary                      |
| `@shiqi/rabbitmq`     | AMQP 0-9-1 broker model (`Broker`), routing, `rabbitmqctl` / `rabbitmqadmin` emulator                                |
| `@shiqi/rabbitmq-viz` | Stage (publishers → exchanges → queues → consumers), inspector, panels, terminal, stories, text                      |

UI text lives in `RABBIT_STRINGS` (`@shiqi/rabbitmq-viz/strings`); the site
passes Chinese from `apps/web/app/i18n/strings/zh.ts` under `rabbitmq.lab`.

## What the simulation covers

Exchanges (direct, fanout, topic, headers, default, alternate), exchange-to-exchange
bindings, mandatory and publisher confirms, prefetch, manual/auto ack, nack and
reject, redelivery on crash, dead-letter exchanges with `x-death`, message TTL
(head-of-queue expiry), `x-max-length` with `drop-head` / `reject-publish`,
quorum queues with `x-delivery-limit`, single active consumer, and network delay.

## Stories (M1, shipped)

hello, work-queue, crash, fanout, direct, topic, unroutable, dead-letter, ttl,
max-length. Each step's `expect` in `scenarios.ts` is checked by
`scenarios.test.ts`.

## Next

1. A real RabbitMQ on shiqi-1: compose profile with a memory cap, AMQPS with
   certificate (EXTERNAL) login on 127.0.0.1 only, reached through the SSH tunnel
   in `infra/local/connect.sh`; a read-only snapshot from the management API and a
   `/rabbitmq?mode=real` view.
2. Streams: the append-only queue type, with offsets and replay (compare with Kafka).
3. Quorum queues across nodes: leader, followers, node loss.
4. Move Kafka's `PacketLayer` onto the shared `FlowLayer` in `@shiqi/ui`.
5. More stories: RPC with reply-to, priority queues, consumer cancel, headers exchange.
