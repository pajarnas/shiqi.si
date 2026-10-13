import { Button, cx } from '@shiqi/ui';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface Lock {
  locked: boolean;
  /** Why, shown on the controls that are off. */
  note: string;
}

const LockContext = createContext<Lock>({ locked: false, note: '' });

/**
 * Turns off every control below it that changes the simulation (the toolbar's
 * clock, LabAction buttons, LabLockable forms), e.g. while a story plays.
 * Looking (selecting, inspecting) stays on.
 */
export function LabLock({ locked, note, children }: Lock & { children: ReactNode }) {
  const value = useMemo(() => ({ locked, note }), [locked, note]);
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export const useLabLock = () => useContext(LockContext);

/** A button that changes the simulation (crash, power off, pause): off while the lab is locked. */
export function LabAction({ disabled, title, ...rest }: Parameters<typeof Button<'button'>>[0]) {
  const { locked, note } = useLabLock();
  return <Button {...rest} disabled={locked || disabled} title={locked ? note : title} />;
}

/** Forms or a terminal that change the simulation: all off while the lab is locked (the toolbar says why). */
export function LabLockable({ className, children }: { className?: string; children: ReactNode }) {
  const { locked, note } = useLabLock();
  return (
    <fieldset
      className={cx('lab-lockable', className)}
      disabled={locked}
      title={locked ? note : undefined}
    >
      {children}
    </fieldset>
  );
}
