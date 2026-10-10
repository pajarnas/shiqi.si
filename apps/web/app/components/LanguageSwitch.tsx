import { Form, useLocation } from 'react-router';
import { LANGUAGES, LOCALES, useI18n } from '~/i18n';

/**
 * Language picker, styled like the theme picker. It's a plain form post, so it
 * works without JavaScript too (the button shows only then).
 */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const location = useLocation();
  return (
    <Form method="post" action="/api/locale" className="ui-theme-select lang-switch">
      <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
      <label>
        <span className="ui-visually-hidden">{t.language.label}</span>
        <select
          className="ui-input"
          name="locale"
          defaultValue={locale}
          key={locale}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={LANGUAGES[l].tag}>
              {LANGUAGES[l].name}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="lang-switch__btn">
          {t.language.label}
        </button>
      </noscript>
    </Form>
  );
}
