# @shiqi/rabbitmq

A deterministic model of a RabbitMQ broker (AMQP 0-9-1): exchanges, bindings,
queues with TTL / length limits / dead-lettering / delivery limits, publishers
with confirms and mandatory, consumers with prefetch, ack, nack and reject, and
network delay. `BrokerTimeline` records actions so the lab can rewind, and
`runRabbitCli` emulates `rabbitmqctl` and `rabbitmqadmin`. See docs/rabbitmq/plan.md.
