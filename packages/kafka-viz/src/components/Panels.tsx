import {
  KafkaError,
  type Acks,
  type Assignor,
  type Cluster,
  type KeyMode,
  type OffsetReset,
} from '@shiqi/kafka';
import {
  Button,
  Field,
  List,
  ListItem,
  Range,
  Segmented,
  Select,
  TextInput,
  useToast,
} from '@shiqi/ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { format, useKafkaStrings } from '../strings';

const ACKS: Acks[] = [0, 1, 'all'];
const KEY_MODES: KeyMode[] = ['none', 'fixed', 'unique'];
const ASSIGNORS: Assignor[] = ['range', 'roundrobin', 'cooperative-sticky'];
const RESETS: OffsetReset[] = ['latest', 'earliest'];

/** Run an admin call; Kafka errors become a toast instead of a crash. */
function useAdmin() {
  const toast = useToast();
  return (fn: () => void) => {
    try {
      fn();
      return true;
    } catch (e) {
      if (!(e instanceof KafkaError)) throw e;
      toast(e.message);
      return false;
    }
  };
}

function Form({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form className="kv-form" onSubmit={submit}>
      <div className="kv-form__fields">{children}</div>
      <Button type="submit">{title}</Button>
    </form>
  );
}

function TopicSelect({
  cluster,
  value,
  onChange,
  id,
}: {
  cluster: Cluster;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {[...cluster.topics.keys()].map((n) => (
        <option key={n}>{n}</option>
      ))}
    </Select>
  );
}

export function TopicsPanel({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  const admin = useAdmin();
  const [name, setName] = useState('events');
  const [partitions, setPartitions] = useState(3);
  const [rf, setRf] = useState(2);
  const [policy, setPolicy] = useState<'delete' | 'compact'>('delete');
  const [minIsr, setMinIsr] = useState(1);
  const live = cluster.liveBrokers.length;

  const create = () =>
    admin(() => {
      cluster.createTopic(name.trim(), {
        partitions,
        replicationFactor: rf,
        config: { 'cleanup.policy': policy, 'min.insync.replicas': minIsr },
      });
      setName(`${name.replace(/-\d+$/, '')}-${cluster.topics.size}`);
    });

  return (
    <div className="kv-panel">
      <List>
        {[...cluster.topics.values()].map((tp) => (
          <ListItem
            key={tp.name}
            title={tp.name}
            description={format(t.topics.summary, {
              partitions: tp.partitions.length,
              rf: tp.partitions[0]?.replicas.length ?? 0,
              policy: tp.config['cleanup.policy'],
            })}
            meta={
              <span className="kv-row-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    admin(() => cluster.addPartitions(tp.name, tp.partitions.length + 1))
                  }
                >
                  {t.topics.addPartition}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => admin(() => cluster.deleteTopic(tp.name))}
                >
                  {t.topics.delete}
                </Button>
              </span>
            }
          />
        ))}
      </List>
      <Form title={t.topics.create} onSubmit={create}>
        <Field label={t.topics.name}>
          {(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={`${t.topics.partitions}: ${partitions}`}>
          {(p) => (
            <Range
              {...p}
              min={1}
              max={8}
              value={partitions}
              onChange={(e) => setPartitions(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={`${t.topics.replication}: ${rf}`}>
          {(p) => (
            <Range
              {...p}
              min={1}
              max={Math.max(1, live)}
              value={Math.min(rf, Math.max(1, live))}
              onChange={(e) => setRf(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={`${t.topics.minIsr}: ${minIsr}`}>
          {(p) => (
            <Range
              {...p}
              min={1}
              max={3}
              value={minIsr}
              onChange={(e) => setMinIsr(Number(e.target.value))}
            />
          )}
        </Field>
        <Segmented
          label={t.topics.policy}
          options={[
            { value: 'delete', label: 'delete' },
            { value: 'compact', label: 'compact' },
          ]}
          value={policy}
          onChange={setPolicy}
        />
      </Form>
    </div>
  );
}

export function ProducersPanel({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  const admin = useAdmin();
  const first = [...cluster.topics.keys()][0] ?? '';
  const [topic, setTopic] = useState(first);
  const [rate, setRate] = useState(3);
  const [acks, setAcks] = useState<Acks>('all');
  const [keys, setKeys] = useState<KeyMode>('fixed');
  const chosen = cluster.topics.has(topic) ? topic : first;

  return (
    <div className="kv-panel">
      <List>
        {[...cluster.producers.values()].map((p) => (
          <ListItem
            key={p.id}
            title={`${p.id} → ${p.topic}`}
            description={
              <span className="kv-inline-controls">
                <Range
                  aria-label={t.produce.rate}
                  min={0}
                  max={30}
                  value={p.rate}
                  onChange={(e) => cluster.updateProducer(p.id, { rate: Number(e.target.value) })}
                />
                <span>{format(t.producer.rate, { rate: p.rate })}</span>
                <Segmented
                  label={t.produce.acks}
                  options={ACKS.map((a) => ({ value: String(a), label: String(a) }))}
                  value={String(p.acks)}
                  onChange={(v) =>
                    cluster.updateProducer(p.id, {
                      acks: v === 'all' ? 'all' : (Number(v) as 0 | 1),
                    })
                  }
                />
              </span>
            }
            meta={
              <Button size="sm" variant="ghost" onClick={() => cluster.removeProducer(p.id)}>
                {t.producer.remove}
              </Button>
            }
          />
        ))}
      </List>
      <Form
        title={t.produce.add}
        onSubmit={() => admin(() => void cluster.addProducer({ topic: chosen, rate, acks, keys }))}
      >
        <Field label={t.produce.topic}>
          {(p) => <TopicSelect {...p} cluster={cluster} value={chosen} onChange={setTopic} />}
        </Field>
        <Field label={`${t.produce.rate}: ${rate}`}>
          {(p) => (
            <Range
              {...p}
              min={1}
              max={30}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          )}
        </Field>
        <Segmented
          label={t.produce.acks}
          options={ACKS.map((a) => ({ value: String(a), label: `acks=${a}` }))}
          value={String(acks)}
          onChange={(v) => setAcks(v === 'all' ? 'all' : (Number(v) as 0 | 1))}
        />
        <Segmented
          label={t.produce.keys}
          options={KEY_MODES.map((k) => ({ value: k, label: t.producer.keys[k] }))}
          value={keys}
          onChange={setKeys}
        />
      </Form>
    </div>
  );
}

export function ConsumersPanel({ cluster }: { cluster: Cluster }) {
  const t = useKafkaStrings();
  const admin = useAdmin();
  const first = [...cluster.topics.keys()][0] ?? '';
  const [group, setGroup] = useState('billing');
  const [topic, setTopic] = useState(first);
  const [assignor, setAssignor] = useState<Assignor>('range');
  const [reset, setReset] = useState<OffsetReset>('latest');
  const [rate, setRate] = useState(4);
  const chosen = cluster.topics.has(topic) ? topic : first;

  return (
    <div className="kv-panel">
      <List>
        {[...cluster.groups.values()].flatMap((g) =>
          [...g.members.values()].map((m) => (
            <ListItem
              key={m.id}
              title={`${g.id} / ${m.clientId}`}
              description={
                <span className="kv-inline-controls">
                  <Range
                    aria-label={t.consume.rate}
                    min={0}
                    max={40}
                    value={m.rate}
                    onChange={(e) =>
                      cluster.updateConsumer(g.id, m.id, { rate: Number(e.target.value) })
                    }
                  />
                  <span>{format(t.group.rate, { rate: m.rate })}</span>
                </span>
              }
            />
          )),
        )}
      </List>
      <Form
        title={t.consume.add}
        onSubmit={() =>
          admin(
            () =>
              void cluster.addConsumer({
                group: group.trim(),
                topics: [chosen],
                assignor,
                offsetReset: reset,
                rate,
              }),
          )
        }
      >
        <Field label={t.consume.group}>
          {(p) => <TextInput {...p} value={group} onChange={(e) => setGroup(e.target.value)} />}
        </Field>
        <Field label={t.consume.topic}>
          {(p) => <TopicSelect {...p} cluster={cluster} value={chosen} onChange={setTopic} />}
        </Field>
        <Field label={`${t.consume.rate}: ${rate}`}>
          {(p) => (
            <Range
              {...p}
              min={1}
              max={40}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={t.consume.assignor}>
          {(p) => (
            <Select
              {...p}
              value={assignor}
              onChange={(e) => setAssignor(e.target.value as Assignor)}
            >
              {ASSIGNORS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          )}
        </Field>
        <Segmented
          label={t.consume.reset}
          options={RESETS.map((r) => ({ value: r, label: r }))}
          value={reset}
          onChange={setReset}
        />
      </Form>
    </div>
  );
}
