import { CRITTER_SIZE, drawCritter } from '@shiqi/pixel';
import { PixelCanvas, buttonClass, type DrawFrame } from '@shiqi/ui';
import { useCallback } from 'react';
import { Link, data } from 'react-router';
import { PageWindow } from '~/components/PageWindow';
import { format, useI18n } from '~/i18n';
import { metaStrings } from '~/i18n/root-data';
import type { Route } from './+types/not-found';

export function loader() {
  return data(null, { status: 404 });
}

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: format(metaStrings(matches).site.pageTitle, { title: '404' }) },
];

export default function NotFound() {
  const { t } = useI18n();
  const draw = useCallback(({ ctx, w, h }: DrawFrame) => {
    ctx.clearRect(0, 0, w, h);
    drawCritter(ctx, 1, 1, { seed: 404 });
  }, []);
  return (
    <PageWindow page="notFound" title={t.notFound.title} lede={t.notFound.lede}>
      <div className="ui-cluster" style={{ gap: '1.5rem' }}>
        <div style={{ width: 96 }}>
          <PixelCanvas
            draw={draw}
            width={CRITTER_SIZE + 2}
            height={CRITTER_SIZE + 2}
            label={t.notFound.critter}
          />
        </div>
        <Link className={buttonClass()} to="/">
          {t.notFound.home}
        </Link>
      </div>
    </PageWindow>
  );
}
