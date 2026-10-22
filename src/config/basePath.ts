/**
 * Resolves the public base path of the built site.
 *
 * A relative base works on any static host, including GitHub Pages project
 * sites. Deployments may set VITE_BASE_PATH to an absolute repository path
 * such as "/cosmos-explorer/".
 */
export function resolveBase(env: Record<string, string | undefined>): string {
  const raw = env.VITE_BASE_PATH?.trim();
  if (!raw) {
    return './';
  }
  if (/^[a-z]+:\/\//i.test(raw)) {
    throw new Error('VITE_BASE_PATH must be a URL path, not a full URL.');
  }
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return `${withLeadingSlash.replace(/\/+$/, '')}/`;
}
