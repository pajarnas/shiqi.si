// The real cluster, read live from /api/kafka/snapshot: brokers drawn like
// the simulation's (each hosting its replicas), topics with offset bars and
// consumer commits, consumer-group lag, the records of a picked partition,
// and admin writes.
import { Button, Checkbox, CopyButton, Field, Section, Select, TextInput, cx } from '@shiqi/ui';
import { useState, type FormEvent } from 'react';
import { format, useI18n } from '~/i18n';
import {
  createTopic,
  deleteTopic,
  produceRecord,
  useRealCluster,
  useRecords,
  type AdminResult,
} from './client';
import { isLabTopic, PARTITIONS_MAX, type KafkaSnapshot, type KafkaTopic } from './snapshot';
import {
  barPosition,
  groupLag,
  partitionKey,
  replicasByBroker,
  underReplicated,
  visibleTopics,
} from './view';

type Pick = { topic: string; partition: number } | null;

export function RealCluster() {
  const { t, locale } = useI18n();
  const s = t.kafka.real;
  const state = useRealCluster();
  const [showInternal, setShowInternal] = useState(false);
  const [pick, setPick] = useState<Pick>(null);

  if (state.kind === 'loading') return <p className="kv-muted">{s.loading}</p>;
  if (state.kind === 'unavailable') return <p className="kv-muted">{s.unavailable}</p>;
  if (state.kind === 'error')
    return <p className="kv-error">{format(s.error, { status: state.status })}</p>;

  const { snapshot, rates } = state;
  const topics = visibleTopics(snapshot, showInternal);
  const picked = pick && topicPartition(snapshot, pick.topic, pick.partition);
  const under = underReplicated(snapshot);

  return (
    <div className="kv-app kr">
      <p className="kr-status">
        <span className="kv-led kv-led--on" aria-hidden="true" />
        {format(s.readAt, { time: new Date(snapshot.at).toLocaleTimeString(locale) })}
        <span className="kv-tag">
          {snapshot.controller === null
            ? s.noController
            : format(s.quorum, { id: snapshot.controller })}
        </span>
        <span className={cx('kv-tag', under > 0 && 'kv-tag--bad')}>
          {under > 0 ? format(s.underReplicated, { n: under }) : s.allInSync}
        </span>
      </p>

      <Brokers snapshot={snapshot} showInternal={showInternal} pick={pick} onPick={setPick} />

      <Section eyebrow="TOPICS" title={s.topics}>
        <Checkbox
          label={s.showInternal}
          checked={showInternal}
          onChange={(e) => setShowInternal(e.target.checked)}
        />
        {topics.length === 0 ? (
          <p className="kv-muted">{s.noTopics}</p>
        ) : (
          topics.map((topic) => (
            <TopicView
              key={topic.name}
              topic={topic}
              snapshot={snapshot}
              rates={rates}
              pick={pick}
              onPick={setPick}
            />
          ))
        )}
      </Section>

      <Section eyebrow="GROUPS" title={s.groups}>
        {snapshot.groups.length === 0 ? (
          <p className="kv-muted">{s.noGroups}</p>
        ) : (
          <div className="kv-brokers">
            {snapshot.groups.map((g) => (
              <div key={g.id} className="kv-group">
                <div className="kv-group__head">
                  <h3>{g.id}</h3>
                </div>
                <p className="kv-group__meta kv-muted">
                  {format(s.groupMeta, {
                    state: g.state,
                    members: g.members.length,
                    assignor: g.assignor || g.protocolType,
                  })}
                </p>
                <div className="kr-chips">
                  {groupLag(g, snapshot.topics).map((l) => (
                    <span
                      key={partitionKey(l.topic, l.partition)}
                      className={cx('kv-chip', l.lag > 0 && 'kv-chip--hot')}
                    >
                      {format(s.replica, { topic: l.topic, partition: l.partition })}
                      <span>{format(s.lag, { n: l.lag })}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="RECORDS" title={s.records}>
        <Records pick={picked ? pick : null} version={picked?.highWatermark ?? 0} />
      </Section>

      <Admin snapshot={snapshot} />
    </div>
  );
}

const topicPartition = (snapshot: KafkaSnapshot, topic: string, partition: number) =>
  snapshot.topics.find((t) => t.name === topic)?.partitions.find((p) => p.id === partition);

function Brokers({
  snapshot,
  showInternal,
  pick,
  onPick,
}: {
  snapshot: KafkaSnapshot;
  showInternal: boolean;
  pick: Pick;
  onPick: (p: Pick) => void;
}) {
  const s = useI18n().t.kafka.real;
  const hosted = replicasByBroker(snapshot, showInternal);
  return (
    <Section eyebrow="BROKERS" title={s.brokers} description={s.legend}>
      <div className="kv-brokers">
        {snapshot.brokers.map((b) => {
          const replicas = hosted.get(b.id) ?? [];
          return (
            <div key={b.id} className="kv-broker">
              <div className="kv-broker__head">
                <span className="kv-led kv-led--on" aria-hidden="true" />
                <strong className="kv-broker__name">{format(s.broker, { id: b.id })}</strong>
                {snapshot.controller === b.id && (
                  <span className="kv-tag kv-tag--controller">{s.controller}</span>
                )}
                <span className="kv-muted">{b.host}</span>
              </div>
              {replicas.length === 0 ? (
                <p className="kv-muted">{s.noReplicas}</p>
              ) : (
                <div className="kv-broker__replicas">
                  {replicas.map((r) => {
                    const hw = topicPartition(snapshot, r.topic, r.partition)?.highWatermark;
                    const selected = pick?.topic === r.topic && pick.partition === r.partition;
                    return (
                      <button
                        key={partitionKey(r.topic, r.partition)}
                        type="button"
                        className={cx(
                          'kv-replica',
                          `kv-replica--${r.role}`,
                          selected && 'kv-replica--selected',
                        )}
                        title={s.roleNames[r.role]}
                        aria-pressed={selected}
                        onClick={() => onPick({ topic: r.topic, partition: r.partition })}
                      >
                        <span className="kv-replica__name">
                          {format(s.replica, { topic: r.topic, partition: r.partition })}
                        </span>
                        <span className="kv-replica__role" aria-label={s.roleNames[r.role]}>
                          {s.roles[r.role]}
                        </span>
                        <span className="kv-replica__leo">{hw}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function TopicView({
  topic,
  snapshot,
  rates,
  pick,
  onPick,
}: {
  topic: KafkaTopic;
  snapshot: KafkaSnapshot;
  rates: Map<string, number>;
  pick: Pick;
  onPick: (p: Pick) => void;
}) {
  const s = useI18n().t.kafka.real;
  const commits = snapshot.groups.flatMap((g) =>
    g.offsets.filter((o) => o.topic === topic.name).map((o) => ({ group: g.id, ...o })),
  );
  return (
    <div className="kr-topic">
      <h3 className="kr-topic__name">
        {topic.name}{' '}
        <span className="kv-muted">
          {format(s.topicMeta, {
            partitions: topic.partitions.length,
            replicas: topic.partitions[0]?.replicas.length ?? 0,
          })}
        </span>
      </h3>
      {Object.keys(topic.configs).length > 0 && (
        <div className="kr-chips">
          {Object.entries(topic.configs).map(([k, v]) => (
            <span key={k} className="kv-chip">
              {k}
              <span>{v}</span>
            </span>
          ))}
        </div>
      )}
      <ul className="kr-partitions">
        {topic.partitions.map((p) => {
          const rate = rates.get(partitionKey(topic.name, p.id)) ?? 0;
          const selected = pick?.topic === topic.name && pick.partition === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={cx('kr-partition', selected && 'kr-partition--selected')}
                aria-pressed={selected}
                onClick={() => onPick({ topic: topic.name, partition: p.id })}
              >
                <strong>{format(s.partition, { id: p.id })}</strong>
                <span className="kv-muted">
                  {format(s.leader, { id: p.leader })} · {format(s.isr, { list: p.isr.join(',') })}{' '}
                  · {format(s.offsets, { start: p.logStartOffset, hw: p.highWatermark })}
                </span>
                <span className={cx('kr-rate', rate > 0 && 'kr-rate--on')}>
                  {format(s.rate, { n: rate.toFixed(1) })}
                </span>
                <span
                  className="kr-bar"
                  role="img"
                  aria-label={format(s.barLabel, { start: p.logStartOffset, hw: p.highWatermark })}
                >
                  <span className="kr-bar__fill" />
                  {commits
                    .filter((c) => c.partition === p.id)
                    .map((c) => (
                      <span
                        key={c.group}
                        className="kr-bar__commit"
                        style={{ left: `${barPosition(p, c.committed) * 100}%` }}
                        title={format(s.commitMark, { group: c.group, offset: c.committed })}
                      />
                    ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Records({ pick, version }: { pick: Pick; version: number }) {
  const { t, locale } = useI18n();
  const s = t.kafka.real;
  const records = useRecords(pick?.topic ?? null, pick?.partition ?? 0, version);
  if (!pick) return <p className="kv-muted">{s.pick}</p>;
  return (
    <>
      <p className="kv-muted">
        {format(s.recordsOf, { topic: pick.topic, partition: pick.partition })}
      </p>
      {records && records.length === 0 && <p className="kv-muted">{s.noRecords}</p>}
      {records && records.length > 0 && (
        <div className="kr-records">
          <table>
            <thead>
              <tr>
                <th>{s.columns.offset}</th>
                <th>{s.columns.key}</th>
                <th>{s.columns.value}</th>
                <th>{s.columns.time}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.offset}>
                  <td>{r.offset}</td>
                  <td>{r.key ?? <i className="kv-muted">{s.none}</i>}</td>
                  <td>{r.value ?? <i className="kv-muted">{s.none}</i>}</td>
                  <td>{new Date(r.timestamp).toLocaleTimeString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Admin({ snapshot }: { snapshot: KafkaSnapshot }) {
  const s = useI18n().t.kafka.real.admin;
  const labTopics = snapshot.topics.map((t) => t.name).filter(isLabTopic);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('lab-orders');
  const [partitions, setPartitions] = useState(3);
  const [chosen, setChosen] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const topic = labTopics.includes(chosen) ? chosen : (labTopics[0] ?? '');

  const report = (r: AdminResult, done: string) =>
    setMessage(
      r.ok
        ? { ok: true, text: done }
        : {
            ok: false,
            text:
              r.status === 401
                ? s.wrongPassword
                : format(s.failed, { status: r.status, error: r.error }),
          },
    );

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    report(await createTopic(password, name, partitions), format(s.created, { topic: name }));
  };
  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    report(await produceRecord(password, topic, key, value), format(s.sent, { topic }));
  };
  const onDelete = async () => {
    if (!window.confirm(format(s.removeConfirm, { topic }))) return;
    report(await deleteTopic(password, topic), format(s.removed, { topic }));
  };

  const curl = `curl -u admin:$ADMIN_PASSWORD -H 'Content-Type: application/json' \\\n  -d '{"topic":"${topic || 'lab-orders'}","key":"k1","value":"hello"}' \\\n  https://shiqi.si/api/kafka/produce`;

  return (
    <details className="kr-admin">
      <summary>{s.title}</summary>
      <p className="kv-muted">{s.lede}</p>
      <Field label={s.password}>
        {(c) => (
          <TextInput
            {...c}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>

      <form className="kv-form" onSubmit={(e) => void onCreate(e)}>
        <div className="kv-form__fields">
          <Field label={s.newTopic}>
            {(c) => <TextInput {...c} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={s.partitions}>
            {(c) => (
              <TextInput
                {...c}
                type="number"
                min={1}
                max={PARTITIONS_MAX}
                value={partitions}
                onChange={(e) => setPartitions(Number(e.target.value))}
              />
            )}
          </Field>
        </div>
        <Button type="submit" disabled={!password || !isLabTopic(name)}>
          {s.create}
        </Button>
      </form>

      {labTopics.length === 0 ? (
        <p className="kv-muted">{s.noLabTopics}</p>
      ) : (
        <form className="kv-form" onSubmit={(e) => void onSend(e)}>
          <div className="kv-form__fields">
            <Field label={s.topic}>
              {(c) => (
                <Select {...c} value={topic} onChange={(e) => setChosen(e.target.value)}>
                  {labTopics.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.key}>
              {(c) => <TextInput {...c} value={key} onChange={(e) => setKey(e.target.value)} />}
            </Field>
            <Field label={s.value}>
              {(c) => <TextInput {...c} value={value} onChange={(e) => setValue(e.target.value)} />}
            </Field>
          </div>
          <div className="kv-row-actions">
            <Button type="submit" disabled={!password}>
              {s.send}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!password}
              onClick={() => void onDelete()}
            >
              {s.remove}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p className={message.ok ? 'kv-muted' : 'kv-error'} role="status">
          {message.text}
        </p>
      )}

      <p className="kv-muted">{s.curl}</p>
      <pre className="kr-curl">{curl}</pre>
      <CopyButton text={curl} />
    </details>
  );
}
