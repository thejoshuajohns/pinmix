export interface BoardPath {
  username: string;
  slug: string;
}

const reservedUsernames = new Set([
  "pin",
  "search",
  "ideas",
  "today",
  "explore",
  "videos",
  "shopping",
  "settings",
  "business",
  "create",
  "news_hub",
  "messages",
  "login",
  "signup",
  "password",
  "oauth",
  "resource",
  "help",
  "about",
  "policy",
  "_"
]);

export function parseBoardPath(pathname: string): BoardPath | null {
  const segments = pathname.split("/").filter(Boolean);
  const [username, slug] = segments;

  if (
    segments.length !== 2 ||
    reservedUsernames.has(username) ||
    slug.startsWith("_")
  ) {
    return null;
  }

  return { username, slug };
}
