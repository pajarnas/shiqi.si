// GET /api/admin/visits — the visitor log as JSON, behind the admin password.
// Query: page, ip, country (ISO code, or -- for unknown), path, bots=1.
//   curl -u admin:$ADMIN_PASSWORD 'https://shiqi.si/api/admin/visits?country=CN&page=2'
import { requireAdmin } from '~/features/visits/auth.server';
import { PAGE_SIZE, parseFilters } from '~/features/visits/visits';
import { countryCounts, listVisits, overview } from '~/features/visits/visits.server';
import { getDb } from '~/lib/db.server';

export async function loader({ request }: { request: Request }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = await getDb();
  if (!db) return Response.json({ error: 'database unavailable' }, { status: 503 });
  const filters = parseFilters(new URL(request.url).searchParams);
  const [log, totals, countries] = await Promise.all([
    listVisits(db, filters),
    overview(db),
    countryCounts(db),
  ]);
  return Response.json(
    {
      filters,
      totals,
      countries,
      page: log.page,
      pages: log.pages,
      pageSize: PAGE_SIZE,
      total: log.total,
      visits: log.rows.map((v) => ({ ...v, ts: v.ts.toISOString() })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
