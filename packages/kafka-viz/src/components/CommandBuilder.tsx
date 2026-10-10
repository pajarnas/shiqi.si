import {
  COMMAND_GROUPS,
  COMMAND_SPECS,
  commandLine,
  principalsIn,
  fieldShown,
  type Cluster,
  type CommandField,
  type CommandGroup,
  type CommandSpec,
  type CommandValues,
  type FieldValue,
} from '@shiqi/kafka';
import { Button, Checkbox, cx, Segmented, Select, TextInput } from '@shiqi/ui';
import { Fragment, useId, useState } from 'react';
import { format, useKafkaStrings } from '../strings';

type Strings = ReturnType<typeof useKafkaStrings>['commands'];

/**
 * Every CLI command as a form: pick a task, click through its options, and
 * watch the command line it makes. Run sends it to the terminal.
 */
export function CommandBuilder({
  cluster,
  onRun,
  onEdit,
}: {
  cluster: Cluster;
  onRun: (line: string) => void;
  onEdit: (line: string) => void;
}) {
  const s = useKafkaStrings().commands;
  const [group, setGroup] = useState<CommandGroup>('topics');
  const [specId, setSpecId] = useState('topicDescribe');
  const [values, setValues] = useState<Record<string, CommandValues>>({});
  const [changed, setChanged] = useState<string | null>(null);

  const spec = (COMMAND_SPECS.find((x) => x.id === specId) ?? COMMAND_SPECS[0]) as CommandSpec;
  const v = resolve(spec, values[spec.id], cluster);
  const tokens = spec.build(v);
  const line = commandLine(tokens);

  const set = (field: string, value: FieldValue) => {
    setValues((old) => ({ ...old, [spec.id]: { ...v, [field]: value } }));
    setChanged(field);
  };
  const pick = (id: string) => {
    setSpecId(id);
    setChanged(null);
  };

  const inGroup = COMMAND_SPECS.filter((x) => x.group === group);
  const groupOptions = COMMAND_GROUPS.map((g) => ({ value: g, label: s.groups[g] }));
  const seekGroup = spec.id === 'groupSeek' ? cluster.groups.get(String(v.group)) : undefined;
  const busy = seekGroup ? [...seekGroup.members.values()].filter((m) => m.alive) : [];

  return (
    <section className="kv-builder" aria-label={s.title}>
      <p className="kv-muted">{s.lede}</p>
      <Segmented
        label={s.title}
        options={groupOptions}
        value={group}
        onChange={(g) => {
          setGroup(g);
          const first = COMMAND_SPECS.find((x) => x.group === g);
          if (first) pick(first.id);
        }}
      />
      <div className="kv-builder__specs">
        {inGroup.map((x) => (
          <button
            key={x.id}
            type="button"
            className={cx(
              'kv-chip',
              'kv-builder__spec',
              x.id === spec.id && 'kv-builder__spec--on',
            )}
            aria-pressed={x.id === spec.id}
            onClick={() => pick(x.id)}
          >
            {specText(s, x.id).title}
          </button>
        ))}
      </div>
      <p className="kv-builder__what">{specText(s, spec.id).what}</p>

      {spec.fields.length > 0 && (
        <div className="kv-builder__fields">
          {spec.fields
            .filter((f) => fieldShown(f, v))
            .map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={v[f.id]}
                cluster={cluster}
                strings={s}
                onChange={(x) => set(f.id, x)}
              />
            ))}
        </div>
      )}

      {busy.length > 0 && seekGroup && (
        <p className="kv-builder__warn">
          {format(s.groupBusy, { n: busy.length })}{' '}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              for (const m of busy) cluster.removeConsumer(seekGroup.id, m.id);
            }}
          >
            {s.stopMembers}
          </Button>
        </p>
      )}

      <pre className="kv-builder__line" aria-live="polite">
        <span aria-hidden="true">$ </span>
        {tokens.map((tok, i) => (
          // The key includes the text so a changed token re-mounts and flashes again.
          <Fragment key={`${i}:${tok.text}`}>
            {i > 0 && ' '}
            <span className={cx(tok.field && tok.field === changed && 'kv-builder__tok--on')}>
              {tok.text}
            </span>
          </Fragment>
        ))}
      </pre>
      <div className="kv-row-actions">
        <Button size="sm" onClick={() => onRun(line)}>
          {s.run}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(line)}>
          {s.edit}
        </Button>
      </div>
    </section>
  );
}

const specText = (s: Strings, id: string) =>
  (s.specs as Record<string, { title: string; what: string }>)[id] ?? { title: id, what: '' };

/** The reader's values over the defaults, with names that no longer exist swapped for ones that do. */
function resolve(spec: CommandSpec, saved: CommandValues | undefined, c: Cluster): CommandValues {
  const defaults = spec.defaults(c);
  const v = { ...defaults, ...saved };
  for (const f of spec.fields) {
    const x = v[f.id];
    if (f.kind === 'topic' && !c.topics.has(String(x))) v[f.id] = defaults[f.id] ?? '';
    if (f.kind === 'group' && !c.groups.has(String(x))) v[f.id] = defaults[f.id] ?? '';
    if (f.kind === 'broker' && !c.brokers.has(Number(x))) v[f.id] = defaults[f.id] ?? '';
  }
  return v;
}

function FieldInput({
  field: f,
  value,
  cluster,
  strings: s,
  onChange,
}: {
  field: CommandField;
  value: FieldValue | undefined;
  cluster: Cluster;
  strings: Strings;
  onChange: (v: FieldValue) => void;
}) {
  const id = useId();
  const label = (s.fields as Record<string, string>)[f.id] ?? f.id;
  const choice = (c: string) => (s.choices as Record<string, string>)[c] ?? c;

  if (f.kind === 'switch')
    return (
      <Checkbox
        label={label}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );

  let control;
  if (f.kind === 'topic' || f.kind === 'group' || f.kind === 'broker' || f.kind === 'principal') {
    const names =
      f.kind === 'topic'
        ? [...cluster.topics.keys()].sort()
        : f.kind === 'group'
          ? [...cluster.groups.keys()].sort()
          : f.kind === 'principal'
            ? principalsIn(cluster)
            : [...cluster.brokers.keys()].sort((a, b) => a - b).map(String);
    if (!names.length)
      return <p className="kv-muted">{f.kind === 'group' ? s.noGroups : s.noTopics}</p>;
    control = (
      <Select
        id={id}
        value={String(value ?? '')}
        onChange={(e) => onChange(f.kind === 'broker' ? Number(e.target.value) : e.target.value)}
      >
        {f.optional && <option value="">{choice('all')}</option>}
        {names.map((n) => {
          const b = f.kind === 'broker' ? cluster.brokers.get(Number(n)) : undefined;
          return (
            <option key={n} value={n}>
              {b ? `${n} (${s.brokerState[b.up ? (b.slow ? 'slow' : 'up') : 'down']})` : n}
            </option>
          );
        })}
      </Select>
    );
  } else if (f.kind === 'choice' && f.choices) {
    const options = f.choices.map((c) => ({ value: c, label: choice(c) }));
    control =
      f.choices.length <= 4 ? (
        <Segmented
          label={label}
          options={options}
          value={String(value ?? '')}
          onChange={onChange}
        />
      ) : (
        <Select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
  } else if (f.kind === 'int') {
    control = (
      <TextInput
        id={id}
        type="number"
        min={f.min}
        max={f.max}
        value={value === '' || value === undefined ? '' : Number(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  } else {
    control = (
      <TextInput
        id={id}
        value={String(value ?? '')}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="ui-field">
      {f.kind === 'choice' && (f.choices?.length ?? 0) <= 4 ? (
        <span className="ui-field__label">{label}</span>
      ) : (
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {control}
    </div>
  );
}
