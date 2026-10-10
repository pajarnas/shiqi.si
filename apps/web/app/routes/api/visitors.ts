// GET /api/visitors/countries — how many people (distinct addresses) came from
// each country, for maps and widgets. Counts only; no addresses. Cached 5 minutes.
import { publicCountryCounts } from '~/features/visits/visits.server';

export async function loader() {
  const countries = await publicCountryCounts();
  return Response.json({ countries }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
