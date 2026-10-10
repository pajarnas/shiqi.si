import { Badge, Card, Section } from '@shiqi/ui';
import { Link, data } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { VisitorMap } from '~/components/VisitorMap';
import { requireAdmin } from '~/features/visits/auth.server';
import { VISITS_TEXT as T } from '~/features/visits/text';
import {
  filterQuery,
  flag,
  pageWindow,
  parseFilters,
  shortAgent,
  type VisitFilters,
} from '~/features/visits/visits';
import { countryCounts, listVisits, overview, pageCounts } from '~/features/visits/visits.server';
import { getDb } from '~/lib/db.server';
import type { Route } from './+types/visits';

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

  const filters = parseFilters(new URL(request.url).searchParams);
  const timeZone = process.env.ADMIN_TIME_ZONE ?? 'America/New_York';
  const db = await getDb();
  if (!db) return { available: false as const, filters, timeZone };

  const [log, totals, countries, pages] = await Promise.all([
    listVisits(db, filters),
    overview(db),
    countryCounts(db),
    pageCounts(db),
  ]);
  const when = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const regionName = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
  const name = (code: string | null) => (code ? (regionName.of(code) ?? code) : T.unknownCountry);
  const host = (ref: string) => {
    try {
      return new URL(ref).host;
    } catch {
      return '';
    }
  };

  return {
    available: true as const,
    filters,
    timeZone,
    totals,
    countries: countries.map((c) => ({ ...c, name: name(c.country), flag: flag(c.country) })),
    pages: pages.map((p) => ({ ...p, last: when.format(p.last) })),
    log: {
      total: log.total,
      page: log.page,
      pages: log.pages,
      rows: log.rows.map((v) => ({
        id: v.id,
        when: when.format(v.ts),
        ip: v.ip,
        country: v.country,
        countryName: name(v.country),
        flag: flag(v.country),
        path: v.path,
        agent: shortAgent(v.ua),
        ua: v.ua,
        from: host(v.referrer),
        bot: v.bot,
      })),
    },
  };
}

export default function VisitsPage({ loaderData: d }: Route.ComponentProps) {
  const f = d.filters;
  return (
    <PageWindow file={T.file} eyebrow={T.eyebrow} title={T.title} lede={T.lede}>
      {!d.available ? (
        <Card padded>{T.unavailable}</Card>
      ) : (
        <>
          <div className="vadmin__stats">
            <Stat label={T.statViews} value={d.totals.views} />
            <Stat label={T.statVisitors} value={d.totals.visitors} />
            <Stat label={T.statCountries} value={d.totals.countries} />
            <Stat label={T.statBots} value={d.totals.bots} />
          </div>

          <Section title={T.mapTitle} description={T.mapDesc}>
            <VisitorMap
              counts={Object.fromEntries(
                d.countries.filter((c) => c.country).map((c) => [c.country, c.visitors]),
              )}
              names={Object.fromEntries(d.countries.map((c) => [c.country ?? '', c.name]))}
              label={T.mapLabel}
              title={T.mapTitle}
            />
          </Section>

          <Section title={T.countriesTitle} description={T.countriesDesc}>
            <Card className="vadmin__countries">
              {d.countries.map((c) => {
                const code = c.country ?? '--';
                return (
                  <Link
                    key={code}
                    className="vadmin__chip"
                    to={filterQuery({ ...f, country: code, page: 1 })}
                    aria-current={f.country === code}
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    {c.name}
                    <small>
                      {c.visitors} / {c.views}
                    </small>
                  </Link>
                );
              })}
            </Card>
          </Section>

          <Section title={T.pagesTitle} description={T.pagesDesc}>
            <Card>
              <table className="vadmin__pages">
                <thead>
                  <tr>
                    <th>{T.colPage}</th>
                    <th className="num">{T.colViews}</th>
                    <th className="num">{T.colReaders}</th>
                    <th className="when">{T.colLast}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pages.map((p) => (
                    <tr key={p.path}>
                      <td>
                        <Link to={p.path}>{p.path}</Link>
                      </td>
                      <td className="num">{p.views}</td>
                      <td className="num">
                        <Link to={filterQuery({ ...f, path: p.path, page: 1 })}>{p.readers}</Link>
                      </td>
                      <td className="when">{p.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section
            id="log"
            title={T.logTitle}
            description={`${T.logDesc(d.log.total, d.log.page, d.log.pages)} ${T.timeZoneNote(d.timeZone)}`}
          >
            <Filters f={f} countryName={nameOf(d.countries, f.country)} />
            <Card>
              {d.log.rows.length === 0 ? (
                <p className="vadmin__empty">{T.logEmpty}</p>
              ) : (
                <ol className="vadmin__log">
                  {d.log.rows.map((v) => (
                    <li key={v.id} className="vadmin__visit">
                      <div className="vadmin__line">
                        <span className="vadmin__time">{v.when}</span>
                        <Link
                          to={filterQuery({ ...f, country: v.country ?? '--', page: 1 })}
                          title={v.countryName}
                        >
                          {v.flag} {v.countryName}
                        </Link>
                        <Link className="vadmin__ip" to={filterQuery({ ...f, ip: v.ip, page: 1 })}>
                          {v.ip}
                        </Link>
                        <Link to={filterQuery({ ...f, path: v.path, page: 1 })}>{v.path}</Link>
                      </div>
                      <div className="vadmin__line vadmin__sub">
                        <span title={v.ua}>{v.agent}</span>
                        <span>{v.from ? T.from(v.from) : T.direct}</span>
                        <a
                          href={`https://ipinfo.io/${encodeURIComponent(v.ip)}`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {T.lookup}
                        </a>
                        {v.bot && <Badge>{T.bot}</Badge>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Pager f={f} page={d.log.page} pages={d.log.pages} />
          </Section>
        </>
      )}
    </PageWindow>
  );
}

const nameOf = (countries: { country: string | null; name: string }[], code: string) =>
  countries.find((c) => (c.country ?? '--') === code)?.name ?? code;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="vadmin__stat">
      <span className="ui-muted">{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

function Filters({ f, countryName }: { f: VisitFilters; countryName: string }) {
  const active: [string, Partial<VisitFilters>][] = [];
  if (f.ip) active.push([T.filterIp(f.ip), { ip: '' }]);
  if (f.country) active.push([T.filterCountry(countryName), { country: '' }]);
  if (f.path) active.push([T.filterPath(f.path), { path: '' }]);
  return (
    <div className="vadmin__filters">
      {active.map(([label, clear]) => (
        <Badge key={label} tone="green">
          {label}{' '}
          <Link to={filterQuery({ ...f, ...clear, page: 1 })} aria-label={T.clearAll}>
            {T.clearFilter}
          </Link>
        </Badge>
      ))}
      {active.length > 1 && <Link to={filterQuery({ bots: f.bots })}>{T.clearAll}</Link>}
      <Link to={filterQuery({ ...f, bots: !f.bots, page: 1 })}>
        {f.bots ? T.hideBots : T.showBots}
      </Link>
    </div>
  );
}

function Pager({ f, page, pages }: { f: VisitFilters; page: number; pages: number }) {
  if (pages <= 1) return null;
  const to = (n: number) => `${filterQuery({ ...f, page: n })}#log`;
  return (
    <nav className="vadmin__pager" aria-label={T.pagerLabel}>
      {page > 1 && <Link to={to(page - 1)}>{T.prev}</Link>}
      {pageWindow(page, pages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`}>…</span>
        ) : (
          <Link key={n} to={to(n)} aria-current={n === page ? 'page' : undefined}>
            {n}
          </Link>
        ),
      )}
      {page < pages && <Link to={to(page + 1)}>{T.next}</Link>}
    </nav>
  );
}
