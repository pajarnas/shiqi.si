import { data } from 'react-router';
import { ErrorScreen, errorText } from '~/components/ErrorScreen';
import { pageMeta } from '~/components/PageWindow';
import type { Route } from './+types/not-found';

export function loader() {
  return data(null, { status: 404 });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: '404', description: errorText(t, 404).lede }));

export default function NotFound() {
  return <ErrorScreen status={404} />;
}
