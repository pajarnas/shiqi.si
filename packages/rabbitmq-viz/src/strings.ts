// Every word @shiqi/rabbitmq-viz shows. English is the default; apps pass
// their own translation through <RabbitStringsProvider> (the site keeps zh in
// its i18n/strings and lets the translation service fill the rest).
// Text in <tags> becomes a glossary term (see `glossary`) or <b>/<code>.
import { LAB_STRINGS } from '@shiqi/lab';

export const RABBIT_STRINGS = {
  toolbar: LAB_STRINGS.toolbar,
  loop: LAB_STRINGS.loop,
  lock: LAB_STRINGS.lock,
  lanes: {
    publishers: 'Publishers',
    exchanges: 'Exchanges',
    queues: 'Queues',
    consumers: 'Consumers',
    noPublishers: 'No publishers. Add one in the Publish panel below.',
    noQueues: 'No queues yet. Declare one in the Declare panel or the terminal.',
    noConsumers: 'No consumers. Add one in the Consume panel below.',
  },
  publisher: {
    to: 'to {exchange}',
    rate: '{rate}/s',
    manual: 'by hand',
    keys: 'Routing keys it uses in turn',
    confirm: 'confirms',
    mandatory: 'mandatory',
    stats: 'sent {sent} · confirmed {confirmed} · returned {returned} · nacked {nacked}',
    onWire: '{n} on the way',
    sendOne: 'Send one',
    pause: 'Pause',
    resume: 'Resume',
    remove: 'Remove',
  },
  exchange: {
    default: '(default)',
    defaultHint:
      'The default exchange has no name. Every queue is bound to it with its own name as the key, so publishing to it with key "jobs" puts the message in the queue "jobs".',
    types: {
      direct: 'direct: to queues bound with exactly this key',
      fanout: 'fanout: a copy to every bound queue, key ignored',
      topic: 'topic: to queues whose pattern matches the key (* = one word, # = any words)',
      headers: 'headers: to queues whose binding headers match the message headers',
    },
    alternate: 'AE → {name}',
    alternateHint:
      'Alternate exchange: messages no binding matches go to {name} instead of vanishing.',
    internal: 'internal',
    stats: 'in {in} · routed {routed} · unroutable {unroutable}',
    bindings: '{n} bindings',
    all: 'all',
    headersMatch: '{mode}: {pairs}',
  },
  queue: {
    ready: 'Ready',
    unacked: 'Unacked',
    readyHint: 'Waiting to be delivered. The oldest (the head) is on the right, next to go.',
    unackedHint:
      'Delivered to a consumer and not acked yet. If the consumer dies, these come back.',
    more: '+{n}',
    empty: 'empty',
    quorum: 'quorum',
    ttl: 'TTL {s}s',
    maxLength: 'max {n}',
    overflowReject: 'rejects new',
    overflowDrop: 'drops oldest',
    dlx: 'DLX → {name}',
    deliveryLimit: 'limit {n}',
    sac: 'single active',
    stats:
      'in {enqueued} · acked {acked} · redelivered {redelivered} · dead-lettered {deadLettered} · dropped {dropped}',
    message: '{body} · key {key}{redelivered}',
    redeliveredMark: ' · redelivered',
    inspect: 'Inspect',
    purge: 'Purge',
  },
  consumer: {
    on: 'on {queue}',
    prefetch: 'prefetch {n}',
    prefetchNone: 'no prefetch limit',
    autoAck: 'auto-ack',
    work: '{ms} ms per message',
    fails: 'every {n}th fails → {action}',
    actions: { requeue: 'nack, requeue', reject: 'reject' },
    window: 'Its prefetch window: one box per message it may hold unacked',
    slotWire: 'On the way to it',
    slotWaiting: 'Waiting its turn',
    slotWorking: 'Working on it',
    slotSettling: 'Done; its ack is on the way back',
    idle: 'idle',
    working: 'working',
    paused: 'paused',
    down: 'crashed',
    stats: 'acked {acked} · nacked {nacked} · rejected {rejected} · lost {lost}',
    pause: 'Pause',
    resume: 'Resume',
    crash: 'Crash',
    restart: 'Restart',
    remove: 'Remove',
  },
  panels: {
    label: 'Panels',
    inspect: 'Inspect',
    terminal: 'Terminal',
    declare: 'Declare',
    publish: 'Publish',
    consume: 'Consume',
    settings: 'Settings',
    events: 'Events',
  },
  inspect: {
    none: 'Click a queue on the stage to look inside it.',
    title: 'Queue {name}',
    args: 'Arguments',
    noArgs: 'No arguments: a plain classic queue.',
    bindings: 'Bound from',
    noBindings: 'Only the default exchange (by its own name).',
    consumers: 'Consumers',
    noConsumers: 'Nobody is consuming from it.',
    messages: 'Ready messages, head first',
    noMessages: 'No ready messages.',
    columns: {
      id: '#',
      body: 'Body',
      key: 'Routing key',
      redelivered: 'Redelivered',
      deliveries: 'Deliveries',
      deaths: 'x-death',
      age: 'Waiting',
    },
    yes: 'yes',
    no: 'no',
    death: '{count}× {reason} in {queue}',
    seconds: '{s} s',
  },
  forms: {
    exchange: 'Declare an exchange',
    queue: 'Declare a queue',
    binding: 'Bind',
    name: 'Name',
    type: 'Type',
    alternate: 'Alternate exchange',
    none: '(none)',
    ttl: 'Message TTL (ms)',
    maxLength: 'Max length',
    overflow: 'When full',
    dlx: 'Dead-letter exchange',
    dlrk: 'Dead-letter routing key',
    queueType: 'Queue type',
    deliveryLimit: 'Delivery limit',
    source: 'From exchange',
    destination: 'To queue',
    bindingKey: 'Binding key',
    bindingKeyHint: 'direct: a word. topic: a pattern like order.* or #. fanout: ignored.',
    declare: 'Declare',
    bind: 'Bind',
    bindings: 'Bindings',
    unbind: 'Unbind',
    deleteExchange: 'Delete exchange',
    deleteQueue: 'Delete queue',
    publishOnce: 'Publish one message',
    exchangeTo: 'Exchange',
    routingKey: 'Routing key',
    body: 'Body',
    addPublisher: 'Add a publisher',
    keys: 'Routing keys (comma separated)',
    rate: 'Messages per second',
    confirm: 'Publisher confirms',
    mandatory: 'Mandatory',
    addConsumer: 'Add a consumer',
    queue_: 'Queue',
    tag: 'Consumer tag',
    prefetch: 'Prefetch (0 = no limit)',
    autoAck: 'Auto-ack',
    workMs: 'Work per message (ms)',
    failEvery: 'Fail every Nth (0 = never)',
    onFail: 'On failure',
    published: 'Published message {id}',
    added: 'Added {name}',
  },
  settings: {
    netMs: 'Network delay, one way: {ms} ms',
    netHint:
      'Every publish, delivery and ack crosses the network. Longer delays show why prefetch matters: with prefetch 1 a consumer waits a round trip between messages.',
  },
  terminal: {
    welcome:
      "RabbitMQ shell. Try 'rabbitmqctl list_queues name messages consumers' or type 'help'.",
    label: 'RabbitMQ terminal',
    input: 'Command',
    stop: 'Stop',
    examples: 'Try one',
  },
  events: {
    ...LAB_STRINGS.events,
    publish: '{publisher} published message {id} to {exchange} with key {key}',
    route: '{exchange} routed message {id} to {queues}',
    unroutableDropped: '{exchange} found no queue for message {id} (key {key}): dropped',
    unroutableReturned:
      '{exchange} found no queue for message {id} (key {key}): returned to {publisher}',
    confirmOk: 'Broker confirmed message {id} to {publisher}',
    confirmNack: 'Broker nacked message {id} to {publisher}',
    deliver: '{queue} delivered message {id} to {consumer}',
    deliverAgain: '{queue} delivered message {id} to {consumer} again (redelivered)',
    processOk: '{consumer} finished message {id}',
    processFail: '{consumer} failed on message {id}',
    ack: '{consumer} acked message {id}',
    nackRequeue: '{consumer} nacked message {id}, asking for a requeue',
    reject: '{consumer} rejected message {id}',
    requeue: 'Message {id} is back at the head of {queue} ({reason})',
    requeueReasons: {
      nack: 'nacked',
      crash: 'its consumer died',
      get: 'basic.get with requeue',
      cancel: 'its consumer cancelled',
    },
    deadLetter: '{queue} dead-lettered message {id} ({reason}) to {exchange}',
    drop: '{queue} dropped message {id} ({reason})',
    reasons: {
      rejected: 'rejected',
      expired: 'TTL expired',
      maxlen: 'queue full',
      delivery_limit: 'delivery limit reached',
    },
    rejectPublish: '{queue} is full: refused message {id}',
    consumerDown: '{consumer} crashed: {requeued} back to {queue}, {lost} lost',
    consumerUp: '{consumer} reconnected to {queue}',
    consumerCancel: '{consumer} stopped consuming from {queue}',
    activeConsumer: '{consumer} is now the single active consumer of {queue}',
    get: 'basic.get took message {id} from {queue}',
    purge: '{queue} purged: {count} messages gone',
    declare: 'Declared {kind} {name}',
    delete: 'Deleted {kind} {name}',
    kinds: { exchange: 'exchange', queue: 'queue', binding: 'binding' },
  },
  story: {
    ...LAB_STRINGS.story,
    beats: {
      publish: {
        title: '{publisher} publishes message {id}',
        body: 'It goes to the <ex>exchange</ex> {exchange}, not to a queue, with the <rk>routing key</rk> <code>{key}</code>. Publishers never pick queues; exchanges do.',
      },
      route: {
        title: '{exchange} routes it to {queues}',
        body: 'The exchange compares the routing key with its <bind>bindings</bind> and puts a copy in every queue that matches. Now it waits in the <q>queue</q>.',
      },
      unroutableDropped: {
        title: '{exchange}: no queue matches {key}',
        body: 'No <bind>binding</bind> fits, so the message is <b>dropped without a word</b>. The publisher thinks it was sent.',
      },
      unroutableReturned: {
        title: '{exchange}: no queue matches, back to {publisher}',
        body: 'The message was published as <mandatory>mandatory</mandatory>, so instead of vanishing it is returned to the publisher (basic.return), which can log it or retry.',
      },
      confirmOk: {
        title: 'Confirmed to {publisher}',
        body: 'With <confirm>publisher confirms</confirm> on, the broker tells the publisher once message {id} is safely in every queue it was routed to.',
      },
      confirmNack: {
        title: 'Nacked to {publisher}',
        body: 'The broker could not take message {id} (a queue refused it), and says so. The publisher knows it must retry or give up.',
      },
      deliver: {
        title: '{queue} hands message {id} to {consumer}',
        body: 'The queue pushes it to a consumer with room in its <prefetch>prefetch</prefetch> window. Until it is acked, it counts as <unacked>unacked</unacked>: still the queue’s responsibility.',
      },
      deliverAgain: {
        title: '{queue} delivers message {id} again',
        body: 'This time it carries <redelivered>redelivered</redelivered> = true: someone had it before and did not ack it. The consumer may be seeing it twice.',
      },
      processFail: {
        title: '{consumer} fails on message {id}',
        body: 'Its code threw. Now it must tell the queue what to do: put it back (nack with requeue) or give up on it (reject).',
      },
      ack: {
        title: '{consumer} acks message {id}',
        body: 'The <ack>ack</ack> travels back to the broker. Only when it arrives does {queue} forget the message for good, and the consumer gets room for the next one.',
      },
      nackRequeue: {
        title: '{consumer} nacks message {id}, requeue',
        body: 'It asks for the message to be put back at the head of {queue}, to be delivered again, maybe to someone else.',
      },
      reject: {
        title: '{consumer} rejects message {id}',
        body: 'Reject without requeue means “never give me this one again”. If {queue} has a <dlx>dead-letter exchange</dlx> it goes there; if not, it is gone.',
      },
      requeue: {
        title: 'Message {id} back at the head of {queue}',
        body: 'Back where it was, marked <redelivered>redelivered</redelivered>. It goes out again as soon as a consumer has room. Reason: {reason}.',
      },
      deadLetter: {
        title: '{queue} dead-letters message {id}',
        body: 'Reason: {reason}. Instead of throwing it away, {queue} republishes it to its <dlx>dead-letter exchange</dlx> {exchange}, with an x-death header that says where it died and why.',
      },
      drop: {
        title: '{queue} drops message {id}',
        body: 'Reason: {reason}. {queue} has no <dlx>dead-letter exchange</dlx>, so the message is simply gone.',
      },
      rejectPublish: {
        title: '{queue} is full and refuses message {id}',
        body: 'x-overflow is reject-publish: the new message is turned away instead of pushing an old one out. With confirms on, the publisher hears about it.',
      },
      consumerDown: {
        title: '{consumer} crashes',
        body: 'Its connection is gone. RabbitMQ puts every message it had not acked ({requeued}) back in {queue}. Messages it got with <autoack>auto-ack</autoack> are not RabbitMQ’s any more: {lost} lost.',
      },
      consumerUp: {
        title: '{consumer} is back',
        body: 'It subscribes again and joins the end of the round-robin line.',
      },
      activeConsumer: {
        title: '{consumer} becomes the active consumer',
        body: 'With single active consumer, only one consumer gets messages at a time; the others wait as hot standbys.',
      },
    },
  },
  legend: {
    title: 'What you see',
    message: 'A message, in its routing key’s colour',
    delivery: 'A delivery to a consumer',
    ack: 'An ack going back',
    bad: 'A nack, reject, drop or dead letter',
    binding: 'A binding, labelled with its key',
    subscription: 'A consumer subscribed to a queue',
    deadRoute: 'Where dead letters go',
    ready: 'A ready message in a queue (head on the right)',
    unacked: 'An unacked message',
    redelivered: 'Redelivered',
  },
  glossary: {
    ex: {
      term: 'Exchange',
      def: 'Where publishers send messages. It never stores them: it looks at the routing key (or headers) and its bindings, and copies the message into the matching queues.',
    },
    bind: {
      term: 'Binding',
      def: 'A rule from an exchange to a queue: “send me messages whose key matches this”. A queue can have many bindings, an exchange many queues.',
    },
    rk: {
      term: 'Routing key',
      def: 'A short string the publisher puts on every message, like order.paid. Exchanges route by it.',
    },
    q: {
      term: 'Queue',
      def: 'An ordered buffer that holds messages until a consumer acks them. Each message is delivered to one consumer of the queue.',
    },
    ack: {
      term: 'Acknowledgement',
      def: 'The consumer telling the broker “done, you can forget this message”. Until then the queue keeps it, and gives it to someone else if the consumer dies.',
    },
    prefetch: {
      term: 'Prefetch (basic.qos)',
      def: 'How many unacked messages a consumer may hold at once. 1 means one at a time; 0 means no limit, so a slow consumer can hoard messages others could be doing.',
    },
    unacked: {
      term: 'Unacked',
      def: 'Delivered but not acknowledged yet. These are not lost if the consumer dies: they go back to the queue.',
    },
    redelivered: {
      term: 'Redelivered flag',
      def: 'Set on a message delivered before and not acked. Consumers should be ready to see it twice (be idempotent).',
    },
    dlx: {
      term: 'Dead-letter exchange (DLX)',
      def: 'Where a queue sends messages it gives up on: rejected, expired, pushed out by a length limit, or past the delivery limit.',
    },
    ttl: {
      term: 'Time to live (TTL)',
      def: 'How long a message may wait in a queue. After that it expires: dead-lettered if the queue has a DLX, else dropped.',
    },
    confirm: {
      term: 'Publisher confirms',
      def: 'The broker acks each message back to the publisher once it is safely queued, or nacks it if it could not take it.',
    },
    mandatory: {
      term: 'Mandatory flag',
      def: 'Publish with mandatory = true and an unroutable message comes back to you (basic.return) instead of vanishing.',
    },
    autoack: {
      term: 'Auto-ack',
      def: 'The broker treats a message as acked the moment it sends it. Fast, but if the consumer dies, whatever it held is lost.',
    },
    defx: {
      term: 'Default exchange',
      def: 'A nameless direct exchange every queue is bound to by its own name. Publishing with key "hello" to it lands in the queue "hello".',
    },
    ae: {
      term: 'Alternate exchange',
      def: 'An exchange set on another exchange: messages that match no binding go there instead of being dropped.',
    },
    quorum: {
      term: 'Quorum queue',
      def: 'A replicated queue type kept by a majority of nodes (Raft). It counts deliveries, so it can stop poison messages with x-delivery-limit.',
    },
  },
  scenarios: {
    ...LAB_STRINGS.scenarios,
    intro:
      'Each story sets up a small broker and walks through it one event at a time. Guess what happens, then watch.',
    groups: {
      basics: 'The basics',
      routing: 'Routing',
      failure: 'When things go wrong',
    },
    sources: {
      tutorial1: 'RabbitMQ tutorial 1: Hello World',
      tutorial2: 'RabbitMQ tutorial 2: Work queues',
      tutorial3: 'RabbitMQ tutorial 3: Publish/Subscribe',
      tutorial4: 'RabbitMQ tutorial 4: Routing',
      tutorial5: 'RabbitMQ tutorial 5: Topics',
      acks: 'RabbitMQ docs: Consumer acknowledgements and publisher confirms',
      ae: 'RabbitMQ docs: Alternate exchanges',
      dlx: 'RabbitMQ docs: Dead letter exchanges',
      ttl: 'RabbitMQ docs: Time-to-live',
      maxlength: 'RabbitMQ docs: Queue length limit',
    },
    list: {
      hello: {
        title: 'One message, start to finish',
        summary: 'Publisher, exchange, queue, consumer, ack: the whole path, slowly.',
        steps: {
          meet: {
            title: 'Four parts',
            body: 'On the left, the publisher <b>app</b>. Next, the <defx>default exchange</defx>. Then the <q>queue</q> <b>hello</b>, and on the right the consumer <b>worker</b>. A publisher never writes into a queue itself: it hands messages to an <ex>exchange</ex>, which decides where they go.',
            result: '',
          },
          send: {
            title: 'Send one message',
            body: 'app publishes one message with the <rk>routing key</rk> <code>hello</code>. Watch it travel.',
            question: 'Once it reaches RabbitMQ, where does it wait?',
            options: [
              'In the exchange',
              'In the queue hello',
              'Nowhere: it goes straight to the worker',
            ],
            result:
              'The exchange only routes; the queue holds the message until the worker has room, and keeps it as <unacked>unacked</unacked> until the worker’s <ack>ack</ack> comes back. Only then is it gone.',
          },
          'why-ack': {
            title: 'Why wait for the ack?',
            body: 'If the worker crashed halfway, a message the queue had already forgotten would be lost. By keeping it until the ack, RabbitMQ can give it to someone else. The cost: a round trip per message.',
            result: '',
          },
          stream: {
            title: 'Now two messages a second',
            body: 'app sends 2 messages a second. The worker takes 0.6 s per message and holds one at a time (<prefetch>prefetch</prefetch> 1), so with the network trips it manages less than one a second.',
            question: 'What happens to the queue?',
            options: [
              'It stays empty',
              'It grows: the queue is a buffer',
              'RabbitMQ slows the publisher down to match',
            ],
            result:
              'After 8 s the worker has done {done} and {waiting} are waiting in hello. A queue absorbs bursts; it doesn’t make consumers faster. Add a worker (next story) or raise prefetch.',
          },
        },
      },
      'work-queue': {
        title: 'Work queues: sharing the load',
        summary:
          'Two workers on one queue. Round-robin, a slow worker, and why prefetch 1 is fairer.',
        steps: {
          'round-robin': {
            title: 'Six tasks, two workers',
            body: 'Two workers consume from <b>tasks</b> with no <prefetch>prefetch</prefetch> limit. app sends 6 tasks.',
            question: 'How are they split?',
            options: [
              'worker-1 takes them all',
              'They alternate: 3 each',
              'Whoever answers first takes most',
            ],
            result:
              'Round-robin: RabbitMQ deals messages out in turn, 1, 2, 1, 2… Each worker got 3.',
          },
          slow: {
            title: 'worker-1 gets slow',
            body: 'worker-1 now takes 3 s per task, worker-2 still 0.4 s. app sends 8 more.',
            question: 'How are these 8 split?',
            options: [
              'Still 4 and 4: RabbitMQ doesn’t look at who is busy',
              'Mostly to worker-2',
              'None to worker-1',
            ],
            result:
              'Still 4 each. With no prefetch limit, worker-1 had all 4 pushed to it at once and sat on them while worker-2 waited with nothing to do.',
          },
          prefetch: {
            title: 'Prefetch 1: fair dispatch',
            body: 'Both workers now set <prefetch>prefetch</prefetch> 1: at most one <unacked>unacked</unacked> task each. app sends 8 more.',
            question: 'Now?',
            options: ['Still 4 and 4', 'worker-2 does most of them', 'worker-1 does most of them'],
            result:
              'worker-1 did {slow}, worker-2 did {fast}. A worker only gets the next task after acking the last, so the fast one keeps coming back for more. This is the setting the tutorial recommends.',
          },
        },
      },
      crash: {
        title: 'A worker dies holding messages',
        summary: 'Unacked messages come back, marked redelivered. With auto-ack they are lost.',
        steps: {
          fill: {
            title: 'Six tasks in flight',
            body: 'Both workers have <prefetch>prefetch</prefetch> 3. worker-1 is slow (2.5 s a task). app sends 6 tasks; after a moment worker-1 holds 3 of them, none acked yet.',
            result: '',
          },
          kill: {
            title: 'Kill worker-1',
            body: 'worker-1 crashes, holding 3 <unacked>unacked</unacked> tasks.',
            question: 'What happens to those 3?',
            options: [
              'They are lost',
              'Back to the queue, marked redelivered; worker-2 does them',
              'They wait for worker-1 to come back',
            ],
            result:
              'RabbitMQ saw the connection drop and requeued them, flagged <redelivered>redelivered</redelivered>. worker-2 did all 6. Nothing lost, but a task worker-1 had half done is done twice: make work idempotent.',
          },
          'auto-ack': {
            title: 'Now with auto-ack',
            body: 'worker-1 comes back with <autoack>auto-ack</autoack> on: RabbitMQ forgets each message the moment it sends it, and pushes as many as it likes. app sends 6 more.',
            result: '',
          },
          'kill-auto': {
            title: 'Kill worker-1 again',
            body: 'worker-1 crashes again, with messages in hand.',
            question: 'What happens to them this time?',
            options: [
              'Lost: RabbitMQ already forgot them',
              'Back to the queue like before',
              'Dead-lettered',
            ],
            result:
              '{lost} lost for good. Auto-ack trades safety for speed; use it only when losing a message is fine.',
          },
        },
      },
      fanout: {
        title: 'Fanout: one message, every queue',
        summary: 'Publish/subscribe: a fanout exchange copies each message to all bound queues.',
        steps: {
          meet: {
            title: 'A fanout exchange',
            body: 'app now publishes to the <ex>exchange</ex> <b>logs</b>, of type fanout. Two queues, <b>screen</b> and <b>disk</b>, are <bind>bound</bind> to it.',
            result: '',
          },
          send: {
            title: 'Publish one log line',
            body: 'app sends one message.',
            question: 'How many copies end up in queues?',
            options: ['One', 'Two: one per bound queue', 'None: it has no matching key'],
            result:
              'Fanout ignores the key and copies to every bound queue. Each queue then delivers its copy to its own consumer.',
          },
          late: {
            title: 'A queue bound later',
            body: 'A new queue <b>audit</b> is declared and bound to logs, then app sends one more message.',
            question: 'Does audit also get the first message?',
            options: [
              'No, only messages published after it was bound',
              'Yes, the exchange replays it',
              'Yes, if it asks',
            ],
            result:
              'Exchanges keep nothing. A queue only sees what is published while it is bound. (Kafka is different: a new consumer can read old messages from the log.)',
          },
        },
      },
      direct: {
        title: 'Direct: route by exact key',
        summary: 'Errors to one queue, everything to another; a key nobody bound is lost.',
        steps: {
          meet: {
            title: 'Bindings with keys',
            body: '<b>direct_logs</b> is a direct exchange. <b>errors</b> is bound with key <code>error</code>; <b>everything</b> is bound three times, with <code>info</code>, <code>warning</code> and <code>error</code>. Three publishers send with those keys.',
            result: '',
          },
          error: {
            title: 'An error',
            body: 'The publisher <b>error</b> sends one message with key <code>error</code>.',
            question: 'Where does it go?',
            options: ['errors only', 'everything only', 'Both queues'],
            result: 'Both: each queue with a binding for that key gets a copy.',
          },
          info: {
            title: 'An info line',
            body: 'Now one with key <code>info</code>.',
            question: 'Where does it go?',
            options: ['errors only', 'everything only', 'Both'],
            result: 'Only everything has an info binding.',
          },
          debug: {
            title: 'A debug line',
            body: 'Now <code>debug</code>. Nobody bound that key.',
            question: 'What happens?',
            options: [
              'It waits in the exchange until someone binds debug',
              'It is dropped, silently',
              'The publisher gets an error',
            ],
            result:
              'Dropped without a word: the exchange counts it as unroutable. The next stories show how to catch these.',
          },
        },
      },
      topic: {
        title: 'Topic: route by pattern',
        summary: 'Keys like quick.orange.rabbit and patterns like *.orange.* or lazy.#',
        steps: {
          meet: {
            title: 'Patterns',
            body: 'Keys are words joined by dots. In a binding, <code>*</code> matches exactly one word and <code>#</code> any number of words. Q1 wants <code>*.orange.*</code>; Q2 wants <code>*.*.rabbit</code> and <code>lazy.#</code>.',
            result: '',
          },
          both: {
            title: 'quick.orange.rabbit',
            body: 'One message with key <code>quick.orange.rabbit</code>.',
            question: 'Which queues get it?',
            options: ['Q1', 'Q2', 'Both'],
            result:
              'Both: *.orange.* and *.*.rabbit each match. Q2 matched with one binding; it would get one copy even if two of its bindings matched.',
          },
          hash: {
            title: 'lazy.orange.male.rabbit',
            body: 'Four words this time: <code>lazy.orange.male.rabbit</code>.',
            question: 'Which queues get it?',
            options: ['Q1', 'Q2', 'Both'],
            result:
              'Only Q2, through lazy.# (# takes any number of words). *.orange.* needs exactly three words.',
          },
          none: {
            title: 'quick.brown.fox',
            body: 'Key <code>quick.brown.fox</code>.',
            question: 'Which queues get it?',
            options: ['Neither', 'Q1', 'Q2'],
            result: 'Neither pattern matches, so it is unroutable and dropped.',
          },
          rest: {
            title: 'Three more',
            body: '<code>lazy.orange.elephant</code> goes to both, <code>quick.orange.fox</code> to Q1, <code>lazy.brown.fox</code> to Q2. Open the terminal and try your own with rabbitmqadmin publish.',
            result: '',
          },
        },
      },
      unroutable: {
        title: 'Messages that match nothing',
        summary: 'Silently dropped, returned with mandatory, or caught by an alternate exchange.',
        steps: {
          silent: {
            title: 'A refund nobody listens for',
            body: 'The exchange <b>orders</b> only has a binding for <code>paid</code>. The shop publishes a <code>refund</code>.',
            question: 'What does the shop learn?',
            options: [
              'It gets an error',
              'Nothing: the message vanishes and the shop thinks it was sent',
              'The message waits',
            ],
            result: 'Gone, silently. That is the default.',
          },
          mandatory: {
            title: 'Publish it as mandatory',
            body: 'careful-shop sends the same refund with the <mandatory>mandatory</mandatory> flag.',
            question: 'Now?',
            options: ['The same', 'It waits in the exchange', 'It comes back to the publisher'],
            result: 'Returned (basic.return). The publisher can log it, alert, or retry later.',
          },
          alternate: {
            title: 'Give orders an alternate exchange',
            body: 'orders is declared again with an <ae>alternate exchange</ae>, <b>unrouted</b>, which fans out to a queue of the same name. The shop sends another refund.',
            question: 'Where does the refund go?',
            options: ['Dropped', 'Into the queue unrouted', 'Back to the shop'],
            result:
              'Caught in unrouted, where someone can look at it later. No publisher had to change.',
          },
        },
      },
      'dead-letter': {
        title: 'Dead letters and poison messages',
        summary:
          'Rejected messages go to a dead-letter exchange; endless requeues are stopped by a delivery limit.',
        steps: {
          reject: {
            title: 'A picky worker',
            body: 'The queue <b>work</b> has a <dlx>dead-letter exchange</dlx>, <b>dlx</b>, which leads to the queue <b>dead</b>. The worker <b>picky</b> fails every third message and rejects it. app sends 3.',
            question: 'Where does the third message end up?',
            options: ['Gone', 'Back in work', 'In dead, through the DLX'],
            result:
              'In dead, with an x-death header: rejected, from work. Open the inspector to see it.',
          },
          requeue: {
            title: 'Requeue instead',
            body: 'Now picky fails on everything and nacks with requeue. app sends one message.',
            question: 'What happens?',
            options: [
              'It is dead-lettered',
              'It comes back again and again, forever',
              'RabbitMQ drops it after 3 tries',
            ],
            result:
              'An endless loop: a poison message. On a classic queue nothing stops it; the worker burns CPU on it forever.',
          },
          limit: {
            title: 'A quorum queue with a delivery limit',
            body: 'work is made again as a <quorum>quorum queue</quorum> with <code>x-delivery-limit</code> 3. app sends one more.',
            question: 'Now?',
            options: [
              'Same endless loop',
              'Dropped after the first failure',
              'Dead-lettered after more than 3 failed deliveries',
            ],
            result:
              'After 4 deliveries it goes to dead with reason delivery_limit. Quorum queues count deliveries; classic ones don’t.',
          },
        },
      },
      ttl: {
        title: 'TTL: messages that expire',
        summary: 'A queue with a message TTL and a DLX makes a delay: the retry-later pattern.',
        steps: {
          meet: {
            title: 'A waiting room',
            body: 'The queue <b>wait-3s</b> has a <ttl>TTL</ttl> of 3 s and a <dlx>dead-letter exchange</dlx>, <b>retry</b>, that leads to <b>tasks</b>. Nobody consumes wait-3s.',
            result: '',
          },
          expire: {
            title: 'Send one into the waiting room',
            body: 'app publishes one message to wait-3s.',
            question: 'What happens after 3 s?',
            options: [
              'It stays forever',
              'It expires and is dropped',
              'It expires and goes through retry to tasks',
            ],
            result:
              'Expired, dead-lettered (reason expired), routed to tasks, delivered, acked: three seconds late.',
          },
          pattern: {
            title: 'Why this is useful',
            body: 'This is the classic delayed retry: when a task fails, publish it to a waiting queue with a TTL; it comes back to the work queue later. Note RabbitMQ only expires messages at the head of a queue, so a long TTL in front holds back shorter ones behind it.',
            result: '',
          },
        },
      },
      'max-length': {
        title: 'A full queue',
        summary:
          'x-max-length with drop-head pushes out the oldest; reject-publish refuses the newest.',
        steps: {
          'drop-head': {
            title: 'Five messages into room for three',
            body: 'The queue <b>buffer</b> holds at most 3 ready messages and nobody consumes it. app sends 5.',
            question: 'Which ones are left?',
            options: ['The first three', 'The last three', 'None'],
            result:
              'The last three. With the default x-overflow, drop-head, each new message pushes the oldest out (dead-lettered if there is a DLX).',
          },
          'reject-publish': {
            title: 'reject-publish, with confirms',
            body: 'buffer is made again with x-overflow reject-publish, and app turns on <confirm>publisher confirms</confirm>. It sends 5.',
            question: 'Now?',
            options: [
              'The same',
              'All five are refused',
              'The first three stay; the last two are nacked to the publisher',
            ],
            result:
              'The queue keeps what it has and refuses the rest, and the publisher gets a nack for each refused message, so it can slow down or retry. This is back-pressure.',
          },
        },
      },
    },
  },
};

export type RabbitStrings = typeof RABBIT_STRINGS;
