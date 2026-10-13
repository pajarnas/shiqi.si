import { Button, useToast } from '@shiqi/ui';
import type { FormEvent, ReactNode } from 'react';

/** Fields in a responsive grid and one submit button. */
export function LabForm({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form className="lab-form" onSubmit={submit}>
      <div className="lab-form__fields">{children}</div>
      <Button type="submit">{title}</Button>
    </form>
  );
}

/**
 * Run an admin call; errors the simulated system raises on purpose (`isExpected`)
 * become a toast instead of a crash. Returns whether the call went through.
 */
export function useAdmin(isExpected: (e: unknown) => e is Error) {
  const toast = useToast();
  return (fn: () => void) => {
    try {
      fn();
      return true;
    } catch (e) {
      if (!isExpected(e)) throw e;
      toast(e.message);
      return false;
    }
  };
}
