/** How long a CDN may keep a public response. */
export const PUBLIC_MAX_AGE_SECONDS = 60;

/**
 * `s-maxage` is only for shared caches such as a CDN. `max-age=0` makes the
 * browser revalidate before reusing its copy, so the CDN is the only place a
 * public response can stay old.
 */
export function sharedCacheControl(maxAgeSeconds: number): string {
  return `public, max-age=0, s-maxage=${maxAgeSeconds}`;
}
