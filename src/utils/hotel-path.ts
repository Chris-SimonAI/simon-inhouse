export function hotelPath(slug: string, path = "") {
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!normalizedSlug) {
    return "/";
  }

  if (!path) {
    return `/${normalizedSlug}`;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${normalizedSlug}${normalizedPath}`;
}

