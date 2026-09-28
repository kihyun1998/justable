/**
 * Joins the truthy class parts and resolves no conflict, so callers never pass one:
 * `docs/map/territory/stylesheet-and-prefix.md`.
 */
export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
