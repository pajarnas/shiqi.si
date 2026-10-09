import { PageWindow, pageMeta } from '~/components/PageWindow';
import { ToyGrid } from '~/components/ToyGrid';

export const meta = () =>
  pageMeta('玩具', '像素壁纸、涂鸦墙、像素画板：几个可以玩、也可以下载成果的小东西。');

export default function PlayIndex() {
  return (
    <PageWindow file="play/" eyebrow="PLAY" title="玩具" lede="可以玩，也可以把成果下载走。">
      <ToyGrid />
    </PageWindow>
  );
}
