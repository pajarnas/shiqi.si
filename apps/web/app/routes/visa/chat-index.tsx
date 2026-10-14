import { redirect } from 'react-router';

/** The chat lives per person; the family page lists everyone. */
export function loader() {
  return redirect('/visa');
}
