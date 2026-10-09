import { Form, useLocation } from 'react-router';
import { LOCALES, useI18n } from '~/i18n';

/** Switch to the other language. Works without JavaScript: it's a plain form post. */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const location = useLocation();
  const next = LOCALES.find((l) => l !== locale) ?? 'en';
  return (
    <Form method="post" action="/api/locale" className="lang-switch">
      <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
      <button
        type="submit"
        name="locale"
        value={next}
        className="lang-switch__btn"
        aria-label={`${t.language.label}: ${t.language[next]}`}
        lang={next === 'zh' ? 'zh-CN' : 'en'}
      >
        {t.language[next]}
      </button>
    </Form>
  );
}
