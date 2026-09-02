import type { BoardPath } from "./board-page.ts";

export type BoardPrivacy = "public" | "secret";

export interface Board {
  id: string;
  name: string;
  url: string;
  pinCount: number;
  sectionCount: number;
  privacy: BoardPrivacy;
}

export interface Section {
  id: string;
  title: string;
  slug: string;
  pinCount: number;
}

export interface Target {
  board: Board;
  section: Section | null;
}

export interface CreatedBoard {
  id: string;
  url: string;
}

export interface CreatedSection {
  id: string;
  url: string;
}

interface ResourceResponse<T> {
  resource_response?: {
    data?: T;
    bookmark?: string;
    message?: string;
    error?: { message?: string; message_detail?: string };
  };
}

interface BoardData {
  id: string;
  name: string;
  url: string;
  pin_count: number;
  section_count: number;
  privacy: string;
}

interface SectionData {
  id: string;
  title: string;
  slug: string;
  pin_count: number;
}

interface FeedItem {
  id: string;
  type: string;
}

type PinCounter = (count: number) => void;

const handlerHeader = { "x-pinterest-pws-handler": "www/[username]/[slug].js" };
const boardFeedPageSize = 250;
const sectionFeedPageSize = 50;
const feedEnd = "-end-";

export async function getTarget(
  path: BoardPath,
  signal?: AbortSignal
): Promise<Target> {
  const board = await getBoard(path, signal);

  if (!path.section) {
    return { board, section: null };
  }

  const sections = await getSections(board, signal);
  const section = sections.find((candidate) => candidate.slug === path.section);

  if (!section) {
    throw new Error(`no section called ${path.section} on this board`);
  }

  return { board, section };
}

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
    sectionCount: data.section_count,
    privacy: data.privacy === "secret" ? "secret" : "public"
  };
}

export async function getSections(
  board: Board,
  signal?: AbortSignal
): Promise<Section[]> {
  const { data } = await callResource<SectionData[]>(
    "BoardSectionsResource",
    "get",
    { board_id: board.id },
    signal
  );

  return data.map((section) => ({
    id: section.id,
    title: section.title,
    slug: section.slug,
    pinCount: section.pin_count
  }));
}

export function fetchBoardPinIds(
  board: Board,
  onCount: PinCounter,
  signal?: AbortSignal
): Promise<string[]> {
  return fetchPinIds(
    "BoardFeedResource",
    {
      board_id: board.id,
      board_url: board.url,
      field_set_key: "react_grid_pin",
      filter_section_pins: true,
      sort: "default",
      layout: "default",
      page_size: boardFeedPageSize
    },
    onCount,
    signal
  );
}

export function fetchSectionPinIds(
  section: Section,
  onCount: PinCounter,
  signal?: AbortSignal
): Promise<string[]> {
  return fetchPinIds(
    "BoardSectionPinsResource",
    {
      section_id: section.id,
      field_set_key: "react_grid_pin",
      page_size: sectionFeedPageSize
    },
    onCount,
    signal
  );
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

export async function createSection(
  board: Board | CreatedBoard,
  title: string,
  signal?: AbortSignal
): Promise<CreatedSection> {
  const { data } = await callResource<SectionData>(
    "BoardSectionResource",
    "create",
    { board_id: board.id, name: title },
    signal
  );

  return { id: data.id, url: `${board.url}${data.slug}/` };
}

export async function savePin(
  pinId: string,
  boardId: string,
  signal?: AbortSignal
): Promise<string> {
  const { data } = await callResource<FeedItem>(
    "RepinResource",
    "create",
    { board_id: boardId, pin_id: pinId, is_buyable_pin: false },
    signal
  );

  return data.id;
}

export async function addSectionPins(
  pinIds: string[],
  sectionId: string,
  signal?: AbortSignal
): Promise<void> {
  await callResource(
    "ApiResource",
    "create",
    { url: `/v3/board/sections/${sectionId}/`, data: { pins: pinIds } },
    signal
  );
}

async function fetchPinIds(
  resource: string,
  options: Record<string, unknown>,
  onCount: PinCounter,
  signal?: AbortSignal
): Promise<string[]> {
  const pinIds = new Set<string>();
  let bookmark: string | undefined;

  do {
    const page = await callResource<FeedItem[]>(
      resource,
      "get",
      { ...options, ...(bookmark && { bookmarks: [bookmark] }) },
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
      result?.error?.message_detail ??
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
