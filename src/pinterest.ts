import type { BoardPath } from "./board-page.ts";

export type BoardPrivacy = "public" | "secret";

export interface Board {
  id: string;
  name: string;
  url: string;
  pinCount: number;
  privacy: BoardPrivacy;
}

export interface CreatedBoard {
  id: string;
  url: string;
}

interface ResourceResponse<T> {
  resource_response?: {
    data?: T;
    bookmark?: string;
    message?: string;
    error?: { message?: string };
  };
}

interface BoardData {
  id: string;
  name: string;
  url: string;
  pin_count: number;
  privacy: string;
}

interface FeedItem {
  id: string;
  type: string;
}

const handlerHeader = { "x-pinterest-pws-handler": "www/[username]/[slug].js" };
const feedPageSize = 250;
const feedEnd = "-end-";

export async function getBoard(
  path: BoardPath,
  signal?: AbortSignal
): Promise<Board> {
  const { data } = await callResource<BoardData>(
    "BoardResource",
    "get",
    { username: path.username, slug: path.slug, field_set_key: "detailed" },
    signal
  );

  return {
    id: data.id,
    name: data.name,
    url: data.url,
    pinCount: data.pin_count,
    privacy: data.privacy === "secret" ? "secret" : "public"
  };
}

export async function fetchBoardPinIds(
  board: Board,
  onCount: (count: number) => void,
  signal?: AbortSignal
): Promise<string[]> {
  const pinIds = new Set<string>();
  let bookmark: string | undefined;

  do {
    const page = await callResource<FeedItem[]>(
      "BoardFeedResource",
      "get",
      {
        board_id: board.id,
        board_url: board.url,
        field_set_key: "react_grid_pin",
        filter_section_pins: false,
        sort: "default",
        layout: "default",
        page_size: feedPageSize,
        ...(bookmark ? { bookmarks: [bookmark] } : {})
      },
      signal
    );

    for (const item of page.data) {
      if (item.type === "pin") {
        pinIds.add(item.id);
      }
    }

    onCount(pinIds.size);
    bookmark = page.data.length > 0 ? page.bookmark : undefined;
  } while (bookmark && bookmark !== feedEnd);

  return [...pinIds];
}

export async function createBoard(
  name: string,
  privacy: BoardPrivacy,
  signal?: AbortSignal
): Promise<CreatedBoard> {
  const { data } = await callResource<BoardData>(
    "BoardResource",
    "create",
    { name, privacy, description: "" },
    signal
  );

  return { id: data.id, url: data.url };
}

export async function savePin(
  pinId: string,
  boardId: string,
  signal?: AbortSignal
): Promise<void> {
  await callResource(
    "RepinResource",
    "create",
    { board_id: boardId, pin_id: pinId, is_buyable_pin: false },
    signal
  );
}

async function callResource<T>(
  resource: string,
  action: "get" | "create",
  options: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ data: T; bookmark?: string }> {
  const params = new URLSearchParams({
    source_url: location.pathname,
    data: JSON.stringify({ options, context: {} })
  });
  const isGet = action === "get";
  const response = await fetch(
    `/resource/${resource}/${action}/${isGet ? `?${params}` : ""}`,
    isGet
      ? { headers: handlerHeader, signal }
      : {
          method: "POST",
          headers: {
            ...handlerHeader,
            "x-csrftoken": readCsrfToken(),
            "content-type": "application/x-www-form-urlencoded"
          },
          body: params.toString(),
          signal
        }
  );
  const body = (await response
    .json()
    .catch(() => null)) as ResourceResponse<T> | null;
  const result = body?.resource_response;

  if (!response.ok || !result?.data) {
    throw new Error(
      result?.error?.message ??
        result?.message ??
        `${resource} ${action} failed (${response.status})`
    );
  }

  return { data: result.data, bookmark: result.bookmark };
}

function readCsrfToken(): string {
  return document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)?.[1] ?? "";
}
