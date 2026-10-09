// GET /api/health — liveness for Kubernetes probes and uptime checks.
const started = new Date();

export function loader() {
  return Response.json(
    {
      status: 'ok',
      startedAt: started.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.APP_VERSION ?? 'dev',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
