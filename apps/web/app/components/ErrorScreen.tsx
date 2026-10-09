import { Button, buttonClass } from '@shiqi/ui';
import { Link, isRouteErrorResponse } from 'react-router';
import { format, useI18n, type Strings } from '~/i18n';
import { CritterCanvas, todaysCritterSeed } from './Toys';
import { PageWindow } from './PageWindow';

/** Status codes with their own words; anything else uses `errors.other`. */
export type ErrorCode = Exclude<
  keyof Strings['errors'],
  'critter' | 'home' | 'back' | 'retry' | 'other'
>;

export function errorText(t: Strings, status: number) {
  return t.errors[status as ErrorCode] ?? t.errors.other;
}

/** The HTTP status for anything an error boundary catches; unknown throws are 500s. */
export function errorStatus(error: unknown): number {
  if (isRouteErrorResponse(error)) return error.status;
  console.error(error);
  return 500;
}

/** Every error page: today's critter holds up the status code in a speech bubble. */
export function ErrorScreen({ status }: { status: number }) {
  const { t } = useI18n();
  const { title, lede } = errorText(t, status);
  const code = String(status);
  // Server trouble may pass, so offer a reload; otherwise going back is more useful.
  const retry = status >= 500;
  return (
    <PageWindow file={`error/${code}`} eyebrow={`ERROR ${code}`} title={title} lede={lede}>
      <div className="error-screen">
        <figure className="error-screen__critter">
          <span className="error-screen__bubble ui-pixel">{code}</span>
          <div className="error-screen__sprite">
            <CritterCanvas seed={todaysCritterSeed()} label={format(t.errors.critter, { code })} />
          </div>
        </figure>
        <div className="ui-cluster">
          <Link className={buttonClass()} to="/">
            {t.errors.home}
          </Link>
          <Button
            variant="secondary"
            onClick={retry ? () => location.reload() : () => history.back()}
          >
            {retry ? t.errors.retry : t.errors.back}
          </Button>
        </div>
      </div>
    </PageWindow>
  );
}
