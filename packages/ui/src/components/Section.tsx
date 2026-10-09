import { useId, type ReactNode } from 'react';
import { cx } from '../cx';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="ui-eyebrow">{children}</span>;
}

export interface SectionProps {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot in the header, e.g. a "see all" link. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A titled region. The heading labels the section for assistive tech. */
export function Section({
  id,
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: SectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cx('ui-section', className)}>
      <div className="ui-section__head">
        <div>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 id={headingId}>{title}</h2>
          {description && <p className="ui-section__desc">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="ui-page-header">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1>{title}</h1>
      {lede && <p className="ui-page-header__lede">{lede}</p>}
      {children}
    </header>
  );
}
