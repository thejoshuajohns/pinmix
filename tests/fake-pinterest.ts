import type { Board } from "../src/pinterest.ts";

export interface FakeRequest {
  resource: string;
  action: string;
  options: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface FakeReply {
  status?: number;
  data?: unknown;
  bookmark?: string;
  error?: { message: string };
}

export type FakeRoute = (options: Record<string, unknown>) => FakeReply;

export const boardPath = "/thejoshuajohns/grad-poses/";

export const board: Board = {
  id: "767512030186446751",
  name: "grad poses",
  url: boardPath,
  pinCount: 3,
  privacy: "public"
};

export function feedItems(...ids: string[]): { id: string; type: string }[] {
  return ids.map((id) => ({ id, type: "pin" }));
}

export function installFakePinterest(
  routes: Record<string, FakeRoute>
): FakeRequest[] {
  const requests: FakeRequest[] = [];

  Object.defineProperty(globalThis, "location", {
    value: { pathname: boardPath, origin: "https://www.pinterest.com" },
    configurable: true
  });
  Object.defineProperty(globalThis, "document", {
    value: { cookie: "_auth=1; csrftoken=token123" },
    configurable: true
  });

  globalThis.fetch = async (input, init) => {
    init?.signal?.throwIfAborted();

    const url = new URL(String(input), "https://www.pinterest.com");
    const [, , resource, action] = url.pathname.split("/");
    const params = init?.body
      ? new URLSearchParams(String(init.body))
      : url.searchParams;
    const options = JSON.parse(params.get("data") ?? "{}").options;
    const reply = routes[`${resource}/${action}`]?.(options) ?? {
      status: 404
    };

    requests.push({
      resource,
      action,
      options,
      headers: Object.fromEntries(new Headers(init?.headers))
    });

    return new Response(
      JSON.stringify({
        resource_response: {
          data: reply.data,
          bookmark: reply.bookmark,
          error: reply.error
        }
      }),
      { status: reply.status ?? 200 }
    );
  };

  return requests;
}
