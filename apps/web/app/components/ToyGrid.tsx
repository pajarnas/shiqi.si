import { Grid, cardClass } from '@shiqi/ui';
import { Link } from 'react-router';
import { ToyThumb } from '~/components/Toys';
import { useI18n } from '~/i18n';
import { TOYS } from '~/site';

const thumbs = {
  '/play/wallpaper': 'wallpaper',
  '/play/doodle': 'doodle',
  '/play/pad': 'pad',
} as const;

export function ToyGrid() {
  const { t } = useI18n();
  return (
    <Grid>
      {TOYS.map((toy) => (
        <Link
          key={toy.path}
          to={toy.path}
          className={`${cardClass({ interactive: true })} toy-card`}
        >
          <ToyThumb kind={thumbs[toy.path as keyof typeof thumbs]} />
          <div className="toy-card__body">
            <span className="ui-eyebrow">{toy.label}</span>
            <h3>{t.entries[toy.key].title}</h3>
            <p>{t.entries[toy.key].description}</p>
          </div>
        </Link>
      ))}
    </Grid>
  );
}
