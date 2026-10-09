import { useMounted } from '../hooks/useMounted';
import { useUiStrings } from '../strings';
import { PixelIcon } from '../components/PixelIcon';
import { THEMES, isThemePreference } from './theme';
import { useTheme } from './ThemeProvider';

/** Native select for the theme: accessible and keyboard-friendly by default. */
export function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const mounted = useMounted();
  const s = useUiStrings();
  return (
    <label className="ui-theme-select">
      <PixelIcon name="theme" size={16} />
      <span className="ui-visually-hidden">{s.theme}</span>
      <select
        className="ui-input"
        value={mounted ? preference : 'auto'}
        onChange={(e) => {
          if (isThemePreference(e.target.value)) setPreference(e.target.value);
        }}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {s.themes[t.id]}
          </option>
        ))}
      </select>
    </label>
  );
}
