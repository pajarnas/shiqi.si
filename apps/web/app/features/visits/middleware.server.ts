import type { MiddlewareFunction } from 'react-router';
import { makeVisit, pagePath } from './visits';
import { recordVisit } from './visits.server';

/** Logs each page view without holding up the response. */
export const recordVisitMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const response = await next();
  const path = request.method === 'GET' ? pagePath(new URL(request.url).pathname) : null;
  if (path && response.status < 400) {
    void recordVisit(makeVisit(request.headers, path, request.headers.get('referer')));
  }
  return response;
};
