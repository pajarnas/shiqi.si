import { Badge, Card, Section } from '@shiqi/ui';
import { Link, data } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { requireAdmin } from '~/features/visits/auth.server';
import { VISITS_TEXT as T } from '~/features/visits/text';
import { LOG_SIZE, summarize } from '~/features/visits/visits';
import { readVisits } from '~/features/visits/visits.server';
import type { Route } from './+types/visits';

const SHOWN = 300;

export const meta = () => [
  { title: `${T.metaTitle} · shiqi.si` },
  { name: 'robots', content: 'noindex' },
];

export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? { 'Cache-Control': 'no-store' };
}

export async function loader({ request }: Route.LoaderArgs) {
  // Thrown, so the site's error page (401, or 404 when there is no password) renders
  // with the auth header kept.
  const denied = requireAdmin(request);
  if (denied) throw data(null, { status: denied.status, headers: denied.headers });
  const url = new URL(request.url);
  const ip = url.searchParams.get('ip') ?? '';
  const bots = url.searchParams.get('bots') === '1';
  const timeZone = process.env.ADMIN_TIME_ZONE ?? 'America/New_York';
  const when = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  });

  const log = await readVisits();
  const people = log.visits.filter((v) => !v.bot);
  const pages = summarize(log.visits, log.totals).map((p) => ({
    ...p,
    last: p.last ? when.format(p.last) : '',
  }));
  const recent = log.visits
    .filter((v) => (bots || !v.bot) && (!ip || v.ip === ip))
    .slice(0, SHOWN)
    .map((v) => ({ ...v, when: when.format(v.t) }));

  return {
    available: log.available,
    ip,
    bots,
    timeZone,
    stats: {
      people: people.length,
      ips: new Set(people.map((v) => v.ip)).size,
      bots: log.visits.length - people.length,
    },
    pages,
    recent,
  };
}

function query(params: { ip?: string; bots?: boolean }) {
  const q = new URLSearchParams();
  if (params.ip) q.set('ip', params.ip);
  if (params.bots) q.set('bots', '1');
  return `?${q}`;
}

export default function VisitsPage({ loaderData: d }: Route.ComponentProps) {
  return (
    <PageWindow file={T.file} eyebrow={T.eyebrow} title={T.title} lede={T.lede(LOG_SIZE)}>
      {!d.available ? (
        <Card padded>{T.unavailable}</Card>
      ) : (
        <>
          <p className="visits-stats">
            {T.stats(d.stats.people, d.stats.ips, d.stats.bots)} · {T.timeZoneNote(d.timeZone)}
          </p>

          <Section title={T.pagesTitle} description={T.pagesDesc}>
            <Card className="visits-table">
              {d.pages.length === 0 ? (
                <p className="visits-empty">{T.pagesEmpty}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{T.colPage}</th>
                      <th className="num">{T.colTotal}</th>
                      <th className="num">{T.colRecent}</th>
                      <th>{T.colReaders}</th>
                      <th>{T.colLast}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.pages.map((p) => (
                      <tr key={p.path}>
                        <td>
                          <Link to={p.path}>{p.path}</Link>
                        </td>
                        <td className="num">{p.total}</td>
                        <td className="num">{p.views}</td>
                        <td>
                          {p.readers.map((ip) => (
                            <Link key={ip} className="visits-ip" to={query({ ip, bots: d.bots })}>
                              {ip}
                            </Link>
                          ))}
                        </td>
                        <td className="nowrap">{p.last}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </Section>

          <Section
            title={T.recentTitle}
            description={T.recentDesc(d.recent.length)}
            actions={
              <span className="visits-actions">
                {d.ip && (
                  <>
                    <Badge tone="green">{T.filteredBy(d.ip)}</Badge>
                    <Link to={query({ bots: d.bots })}>{T.clearFilter}</Link>
                  </>
                )}
                <Link to={query({ ip: d.ip, bots: !d.bots })}>
                  {d.bots ? T.hideBots : T.showBots}
                </Link>
              </span>
            }
          >
            <Card className="visits-table">
              <table>
                <thead>
                  <tr>
                    <th>{T.colTime}</th>
                    <th>{T.colIp}</th>
                    <th>{T.colPage}</th>
                    <th>{T.colAgent}</th>
                    <th>{T.colRef}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((v, i) => (
                    <tr key={`${v.t}-${i}`}>
                      <td className="nowrap">{v.when}</td>
                      <td className="nowrap">
                        <Link className="visits-ip" to={query({ ip: v.ip, bots: d.bots })}>
                          {v.ip}
                        </Link>
                        <a
                          href={`https://ipinfo.io/${encodeURIComponent(v.ip)}`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {T.lookup}
                        </a>
                      </td>
                      <td className="nowrap">
                        {v.path} {v.bot && <Badge>{T.bot}</Badge>}
                      </td>
                      <td className="visits-ua" title={v.ua}>
                        {v.ua}
                      </td>
                      <td className="visits-ua" title={v.ref}>
                        {v.ref}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </>
      )}
    </PageWindow>
  );
}
