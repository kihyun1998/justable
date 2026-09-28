/** Joins the truthy class parts. Conflicting utilities are not resolved, so callers never pass any. */
export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
