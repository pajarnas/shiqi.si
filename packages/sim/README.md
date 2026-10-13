# @shiqi/sim

The pieces every lab simulation shares: a deterministic fixed-step `Simulation`
base class with an event log, a record-and-replay `Timeline` for rewinding,
`BeatFilter` for story mode, `tokenize` / `table` for CLI emulators, and React
hooks (`@shiqi/sim/react`). Used by `@shiqi/kafka` and `@shiqi/rabbitmq`.
