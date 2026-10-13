import { LabForm, useAdmin } from '@shiqi/lab';
import {
  EXCHANGE_TYPES,
  RabbitError,
  type Broker,
  type ExchangeType,
  type FailAction,
  type Overflow,
  type QueueType,
} from '@shiqi/rabbitmq';
import {
  Button,
  Checkbox,
  Field,
  format,
  Range,
  Select,
  TextInput,
  useToast,
  type FieldControlProps,
} from '@shiqi/ui';
import { useState } from 'react';
import { useRabbitStrings } from '../i18n';

const isRabbitError = (e: unknown): e is RabbitError => e instanceof RabbitError;
const useRabbitAdmin = () => useAdmin(isRabbitError);

const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(s) || 0));
const list = (s: string) =>
  s
    .split(',')
    .map((k) => k.trim())
    .filter((k, i, all) => k !== '' || all.length === 1);

function ExchangeSelect({
  broker,
  value,
  onChange,
  none,
  ...control
}: Partial<FieldControlProps> & {
  broker: Broker;
  value: string;
  onChange: (v: string) => void;
  /** Label for "no exchange", when that is allowed. */
  none?: string;
}) {
  const t = useRabbitStrings();
  return (
    <Select {...control} value={value} onChange={(e) => onChange(e.target.value)}>
      {none !== undefined && <option value="">{none}</option>}
      {[...broker.exchanges.keys()]
        .filter((n) => none === undefined || n !== '')
        .map((n) => (
          <option key={n} value={n}>
            {n || t.exchange.default}
          </option>
        ))}
    </Select>
  );
}

function QueueSelect({
  broker,
  value,
  onChange,
  ...control
}: Partial<FieldControlProps> & {
  broker: Broker;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select {...control} value={value} onChange={(e) => onChange(e.target.value)}>
      {[...broker.queues.keys()].map((n) => (
        <option key={n}>{n}</option>
      ))}
    </Select>
  );
}

/** Declare exchanges, queues and bindings, and delete them. */
export function DeclarePanel({ broker: b }: { broker: Broker }) {
  const t = useRabbitStrings();
  const f = t.forms;
  const admin = useRabbitAdmin();
  const [xName, setXName] = useState('events');
  const [xType, setXType] = useState<ExchangeType>('topic');
  const [ae, setAe] = useState('');
  const [qName, setQName] = useState('jobs');
  const [qType, setQType] = useState<QueueType>('classic');
  const [ttl, setTtl] = useState('');
  const [max, setMax] = useState('');
  const [overflow, setOverflow] = useState<Overflow>('drop-head');
  const [dlx, setDlx] = useState('');
  const [limit, setLimit] = useState('');
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [key, setKey] = useState('#');
  const exchanges = [...b.exchanges.values()].filter((x) => !x.builtin);
  const firstX = exchanges[0]?.name ?? '';
  const firstQ = [...b.queues.keys()][0] ?? '';
  return (
    <div className="lab-panel rv-panel">
      <LabForm
        title={f.declare}
        onSubmit={() =>
          admin(() => b.declareExchange(xName.trim(), xType, { alternate: ae || null }))
        }
      >
        <Field label={f.name}>
          {(p) => <TextInput {...p} value={xName} onChange={(e) => setXName(e.target.value)} />}
        </Field>
        <Field label={f.type}>
          {(p) => (
            <Select {...p} value={xType} onChange={(e) => setXType(e.target.value as ExchangeType)}>
              {EXCHANGE_TYPES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={f.alternate}>
          {(p) => <ExchangeSelect {...p} broker={b} value={ae} onChange={setAe} none={f.none} />}
        </Field>
      </LabForm>

      <LabForm
        title={f.declare}
        onSubmit={() =>
          admin(() =>
            b.declareQueue(qName.trim(), {
              args: {
                type: qType,
                messageTtl: num(ttl),
                maxLength: num(max),
                overflow,
                deadLetterExchange: dlx || null,
                deliveryLimit: qType === 'quorum' ? num(limit) : null,
              },
            }),
          )
        }
      >
        <Field label={f.name}>
          {(p) => <TextInput {...p} value={qName} onChange={(e) => setQName(e.target.value)} />}
        </Field>
        <Field label={f.queueType}>
          {(p) => (
            <Select {...p} value={qType} onChange={(e) => setQType(e.target.value as QueueType)}>
              <option>classic</option>
              <option>quorum</option>
            </Select>
          )}
        </Field>
        <Field label={f.ttl}>
          {(p) => (
            <TextInput
              {...p}
              inputMode="numeric"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
            />
          )}
        </Field>
        <Field label={f.maxLength}>
          {(p) => (
            <TextInput
              {...p}
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          )}
        </Field>
        <Field label={f.overflow}>
          {(p) => (
            <Select
              {...p}
              value={overflow}
              onChange={(e) => setOverflow(e.target.value as Overflow)}
            >
              <option value="drop-head">drop-head</option>
              <option value="reject-publish">reject-publish</option>
            </Select>
          )}
        </Field>
        <Field label={f.dlx}>
          {(p) => <ExchangeSelect {...p} broker={b} value={dlx} onChange={setDlx} none={f.none} />}
        </Field>
        {qType === 'quorum' && (
          <Field label={f.deliveryLimit}>
            {(p) => (
              <TextInput
                {...p}
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            )}
          </Field>
        )}
      </LabForm>

      <LabForm
        title={f.bind}
        onSubmit={() =>
          admin(() =>
            b.bind({ source: source || firstX, destination: dest || firstQ, routingKey: key }),
          )
        }
      >
        <Field label={f.source}>
          {(p) => (
            <Select {...p} value={source || firstX} onChange={(e) => setSource(e.target.value)}>
              {exchanges.map((x) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={f.destination}>
          {(p) => <QueueSelect {...p} broker={b} value={dest || firstQ} onChange={setDest} />}
        </Field>
        <Field label={f.bindingKey} hint={f.bindingKeyHint}>
          {(p) => <TextInput {...p} value={key} onChange={(e) => setKey(e.target.value)} />}
        </Field>
      </LabForm>

      <section>
        <h4>{f.bindings}</h4>
        <ul className="rv-list">
          {b.bindings.map((x) => (
            <li key={`${x.source}>${x.destination}:${x.routingKey}`} className="rv-list__row">
              <span>
                <b>{x.source}</b> → <b>{x.destination}</b> <code>{x.routingKey || '""'}</code>
              </span>
              <Button size="sm" variant="ghost" onClick={() => admin(() => b.unbind(x))}>
                {f.unbind}
              </Button>
            </li>
          ))}
        </ul>
        <div className="rv-card__actions">
          {exchanges.map((x) => (
            <Button
              key={x.name}
              size="sm"
              variant="ghost"
              onClick={() => admin(() => b.deleteExchange(x.name))}
            >
              {f.deleteExchange} {x.name}
            </Button>
          ))}
          {[...b.queues.keys()].map((n) => (
            <Button key={n} size="sm" variant="ghost" onClick={() => admin(() => b.deleteQueue(n))}>
              {f.deleteQueue} {n}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Publish one message by hand, or add a publisher that keeps sending. */
export function PublishPanel({ broker: b }: { broker: Broker }) {
  const t = useRabbitStrings();
  const f = t.forms;
  const admin = useRabbitAdmin();
  const toast = useToast();
  const first = [...b.exchanges.values()].find((x) => !x.builtin)?.name ?? '';
  const [exchange, setExchange] = useState<string | null>(null);
  const [key, setKey] = useState('order.paid');
  const [body, setBody] = useState('hello');
  const [mandatory, setMandatory] = useState(false);
  const [pExchange, setPExchange] = useState<string | null>(null);
  const [keys, setKeys] = useState('order.created, order.paid');
  const [rate, setRate] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const ex = exchange ?? first;
  const pex = pExchange ?? first;
  return (
    <div className="lab-panel rv-panel">
      <LabForm
        title={f.publishOnce}
        onSubmit={() =>
          admin(() => {
            const id = b.publish({ exchange: ex, routingKey: key, body, mandatory });
            toast(format(f.published, { id }));
          })
        }
      >
        <Field label={f.exchangeTo}>
          {(p) => <ExchangeSelect {...p} broker={b} value={ex} onChange={setExchange} />}
        </Field>
        <Field label={f.routingKey}>
          {(p) => <TextInput {...p} value={key} onChange={(e) => setKey(e.target.value)} />}
        </Field>
        <Field label={f.body}>
          {(p) => <TextInput {...p} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <Checkbox
          label={f.mandatory}
          checked={mandatory}
          onChange={(e) => setMandatory(e.target.checked)}
        />
      </LabForm>

      <LabForm
        title={f.addPublisher}
        onSubmit={() =>
          admin(() => {
            const p = b.addPublisher({ exchange: pex, keys: list(keys), rate, confirm, mandatory });
            toast(format(f.added, { name: p.id }));
          })
        }
      >
        <Field label={f.exchangeTo}>
          {(p) => <ExchangeSelect {...p} broker={b} value={pex} onChange={setPExchange} />}
        </Field>
        <Field label={f.keys}>
          {(p) => <TextInput {...p} value={keys} onChange={(e) => setKeys(e.target.value)} />}
        </Field>
        <Field label={`${f.rate}: ${rate}`}>
          {(p) => (
            <Range
              {...p}
              min={0.2}
              max={10}
              step={0.2}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          )}
        </Field>
        <Checkbox
          label={f.confirm}
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
      </LabForm>
    </div>
  );
}

/** Add a consumer to a queue. */
export function ConsumePanel({ broker: b }: { broker: Broker }) {
  const t = useRabbitStrings();
  const f = t.forms;
  const admin = useRabbitAdmin();
  const toast = useToast();
  const first = [...b.queues.keys()][0] ?? '';
  const [queue, setQueue] = useState<string | null>(null);
  const [prefetch, setPrefetch] = useState(1);
  const [autoAck, setAutoAck] = useState(false);
  const [workMs, setWorkMs] = useState(500);
  const [failEvery, setFailEvery] = useState(0);
  const [onFail, setOnFail] = useState<FailAction>('requeue');
  const q = queue ?? first;
  return (
    <div className="lab-panel rv-panel">
      <LabForm
        title={f.addConsumer}
        onSubmit={() =>
          admin(() => {
            const c = b.addConsumer({ queue: q, prefetch, autoAck, workMs, failEvery, onFail });
            toast(format(f.added, { name: c.tag }));
          })
        }
      >
        <Field label={f.queue_}>
          {(p) => <QueueSelect {...p} broker={b} value={q} onChange={setQueue} />}
        </Field>
        <Field label={`${f.prefetch}: ${prefetch}`}>
          {(p) => (
            <Range
              {...p}
              min={0}
              max={10}
              value={prefetch}
              onChange={(e) => setPrefetch(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={`${f.workMs}: ${workMs}`}>
          {(p) => (
            <Range
              {...p}
              min={50}
              max={5000}
              step={50}
              value={workMs}
              onChange={(e) => setWorkMs(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={`${f.failEvery}: ${failEvery}`}>
          {(p) => (
            <Range
              {...p}
              min={0}
              max={10}
              value={failEvery}
              onChange={(e) => setFailEvery(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={f.onFail}>
          {(p) => (
            <Select {...p} value={onFail} onChange={(e) => setOnFail(e.target.value as FailAction)}>
              <option value="requeue">{t.consumer.actions.requeue}</option>
              <option value="reject">{t.consumer.actions.reject}</option>
            </Select>
          )}
        </Field>
        <Checkbox
          label={f.autoAck}
          checked={autoAck}
          onChange={(e) => setAutoAck(e.target.checked)}
        />
      </LabForm>
    </div>
  );
}

/** Broker-wide knobs. */
export function SettingsPanel({ broker: b }: { broker: Broker }) {
  const t = useRabbitStrings();
  const s = t.settings;
  return (
    <div className="lab-panel rv-panel">
      <Field label={format(s.netMs, { ms: b.settings.netMs })} hint={s.netHint}>
        {(p) => (
          <Range
            {...p}
            min={0}
            max={1500}
            step={50}
            value={b.settings.netMs}
            onChange={(e) => b.configure({ netMs: Number(e.target.value) })}
          />
        )}
      </Field>
    </div>
  );
}
