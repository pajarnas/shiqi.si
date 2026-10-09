import { redirect } from 'react-router';
import { isLocale } from '~/i18n';
import { localeCookie } from '~/i18n/locale.server';
import type { Route } from './+types/locale';

/** Remember a manual language choice, then go back to the page it came from. */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const locale = form.get('locale');
  if (!isLocale(locale)) throw new Response('Unknown locale', { status: 400 });
  const back = new URL(String(form.get('redirectTo') ?? '/'), 'http://local');
  // Only same-site paths, and drop ?lang= so the saved choice applies.
  back.searchParams.delete('lang');
  const to = back.origin === 'http://local' ? back.pathname + back.search + back.hash : '/';
  return redirect(to, { headers: { 'Set-Cookie': localeCookie(locale) } });
}

export function loader() {
  return redirect('/');
}
