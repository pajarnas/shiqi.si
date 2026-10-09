import { ICONS, iconPath, type IconName } from '@shiqi/pixel';
import { cx } from '../cx';

export interface PixelIconProps {
  name: IconName;
  /** Rendered size in CSS pixels. Multiples of 16 stay crisp. Default 32. */
  size?: number;
  /** Accessible label. Omit for decorative icons. */
  title?: string;
  className?: string;
}

/** A 1-bit icon as inline SVG: ink in currentColor, fill in the surface colour. */
export function PixelIcon({ name, size = 32, title, className }: PixelIconProps) {
  const ic = ICONS[name];
  const dim = Math.max(ic.w, ic.h);
  const ox = (dim - ic.w) / 2;
  const oy = (dim - ic.h) / 2;
  return (
    <svg
      className={cx('ui-icon', className)}
      width={size}
      height={size}
      viewBox={`${-ox} ${-oy} ${dim} ${dim}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path className="ui-icon__fill" d={iconPath(ic, 'fill')} />
      <path className="ui-icon__tone" d={iconPath(ic, 'tone')} />
      <path className="ui-icon__ink" d={iconPath(ic, 'ink')} />
    </svg>
  );
}
