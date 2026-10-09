import { PageWindow, pageMeta } from '~/components/PageWindow';
import { ToyGrid } from '~/components/ToyGrid';
import { useI18n } from '~/i18n';
import type { Route } from './+types/index';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.play);

export default function PlayIndex() {
  const { t } = useI18n();
  return (
    <PageWindow page="play" title={t.play.title} lede={t.play.lede}>
      <ToyGrid />
    </PageWindow>
  );
}
