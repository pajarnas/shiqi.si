import { CRITTER_SIZE, drawCritter } from '@shiqi/pixel';
import { PixelCanvas, buttonClass, type DrawFrame } from '@shiqi/ui';
import { useCallback } from 'react';
import { Link, data } from 'react-router';
import { PageWindow } from '~/components/PageWindow';

export function loader() {
  return data(null, { status: 404 });
}

export const meta = () => [{ title: '404 · shiqi.si' }];

export default function NotFound() {
  const draw = useCallback(({ ctx, w, h }: DrawFrame) => {
    ctx.clearRect(0, 0, w, h);
    drawCritter(ctx, 1, 1, { seed: 404 });
  }, []);
  return (
    <PageWindow
      file="404"
      eyebrow="404"
      title="这里什么都没有"
      lede="可能是链接写错了，也可能是这个页面还没长出来。"
    >
      <div className="ui-cluster" style={{ gap: '1.5rem' }}>
        <div style={{ width: 96 }}>
          <PixelCanvas
            draw={draw}
            width={CRITTER_SIZE + 2}
            height={CRITTER_SIZE + 2}
            label="一只迷路的小怪"
          />
        </div>
        <Link className={buttonClass()} to="/">
          回首页
        </Link>
      </div>
    </PageWindow>
  );
}
