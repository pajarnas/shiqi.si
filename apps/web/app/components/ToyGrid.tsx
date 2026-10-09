import { Grid, cardClass } from '@shiqi/ui';
import { Link } from 'react-router';
import { ToyThumb } from '~/components/Toys';
import { TOYS } from '~/site';

const thumbs = {
  '/play/wallpaper': 'wallpaper',
  '/play/doodle': 'doodle',
  '/play/pad': 'pad',
} as const;

export function ToyGrid() {
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
            <span className="ui-eyebrow">{toy.en}</span>
            <h3>{toy.title}</h3>
            <p>{toy.description}</p>
          </div>
        </Link>
      ))}
    </Grid>
  );
}
