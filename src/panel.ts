import type { BoardPath } from "./board-page.ts";
import { mix, type MixProgress, type MixResult } from "./mix.ts";
import { getTarget, type Target } from "./pinterest.ts";
import { styles } from "./styles.ts";

export interface Panel {
  setBoardPath(path: BoardPath | null): void;
}

type View = "form" | "progress" | "done";
type Kind = "board" | "section";

const shuffleIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h3.5l7 10H21"/><path d="M3 17h3.5l7-10H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/></svg>`;

const template = `
<style>${styles}</style>
<button class="launcher" type="button" hidden>${shuffleIcon}<span></span></button>
<section class="card" role="dialog" aria-labelledby="pinmix-title" hidden>
  <header>
    <div>
      <p class="eyebrow"></p>
      <h2 id="pinmix-title"></h2>
    </div>
    <button class="close" type="button" aria-label="close">×</button>
  </header>
  <p class="subtitle"></p>
  <form class="form">
    <label><span class="name-label"></span><input name="name" required autocomplete="off" /></label>
    <label>seed (optional) <input name="seed" placeholder="same seed, same order" autocomplete="off" /></label>
    <label class="switch" hidden>
      <input name="keepSections" type="checkbox" checked />
      <span>keep sections <small>off mixes every pin together</small></span>
    </label>
    <button class="primary" type="submit">shuffle</button>
    <p class="error" role="alert" hidden></p>
  </form>
  <div class="progress" hidden>
    <p class="status" aria-live="polite"></p>
    <div class="bar"><div class="fill"></div></div>
    <button class="secondary cancel" type="button">stop</button>
  </div>
  <div class="done" hidden>
    <p class="summary" aria-live="polite"></p>
    <a class="open" target="_blank" rel="noopener"></a>
    <button class="secondary again" type="button">shuffle again</button>
  </div>
</section>`;

function kindOf({ section }: Target): Kind {
  return section ? "section" : "board";
}

function describe({ board, section }: Target): string {
  const parts = section
    ? [`section of ${board.name}`, `${section.pinCount} pins`]
    : ["board", `${board.pinCount} pins`];

  if (!section && board.sectionCount > 0) {
    parts.push(`${board.sectionCount} sections`);
  }

  return parts.join(" · ");
}

function summarize({ saved, total }: MixResult, stopped: boolean): string {
  if (stopped) {
    return saved
      ? `stopped after saving ${saved} of ${total} pins`
      : "stopped before any pins were saved";
  }

  if (total === 0) {
    return "no pins could be loaded, so nothing was saved";
  }

  const missed = total - saved;

  return missed
    ? `saved ${saved} of ${total} pins, ${missed} didn't save`
    : `saved all ${total} pins`;
}

export function mountPanel(): Panel {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = template;
  document.body.append(host);

  const query = <T extends Element>(selector: string) =>
    root.querySelector(selector) as T;
  const el = {
    launcher: query<HTMLButtonElement>(".launcher"),
    launcherLabel: query<HTMLElement>(".launcher span"),
    card: query<HTMLElement>(".card"),
    eyebrow: query<HTMLElement>(".eyebrow"),
    title: query<HTMLElement>("#pinmix-title"),
    close: query<HTMLButtonElement>(".close"),
    subtitle: query<HTMLElement>(".subtitle"),
    form: query<HTMLFormElement>(".form"),
    nameLabel: query<HTMLElement>(".name-label"),
    name: query<HTMLInputElement>("[name=name]"),
    seed: query<HTMLInputElement>("[name=seed]"),
    keepSections: query<HTMLInputElement>("[name=keepSections]"),
    keepSectionsField: query<HTMLElement>(".switch"),
    error: query<HTMLElement>(".error"),
    progress: query<HTMLElement>(".progress"),
    status: query<HTMLElement>(".status"),
    fill: query<HTMLElement>(".fill"),
    cancel: query<HTMLButtonElement>(".cancel"),
    done: query<HTMLElement>(".done"),
    summary: query<HTMLElement>(".summary"),
    open: query<HTMLAnchorElement>(".open"),
    again: query<HTMLButtonElement>(".again")
  };

  let target: Target | null = null;
  let loading: AbortController | null = null;
  let controller: AbortController | null = null;

  function show(view: View): void {
    el.form.hidden = view !== "form";
    el.progress.hidden = view !== "progress";
    el.done.hidden = view !== "done";
    el.error.hidden = true;
  }

  function setCardOpen(open: boolean): void {
    el.card.hidden = !open;
    el.launcher.hidden = open || !target;

    if (open && !el.form.hidden) {
      el.name.focus();
      el.name.select();
    }
  }

  function showError(message: string): void {
    el.error.textContent = message;
    el.error.hidden = false;
    el.name.setAttribute("aria-invalid", "true");
    el.name.focus();
  }

  function updateProgress(
    { phase, done, total }: MixProgress,
    kind: Kind
  ): void {
    el.status.textContent =
      phase === "creating"
        ? `creating the new ${kind}`
        : phase === "loading"
          ? `loading pins · ${done}`
          : `saving ${done} of ${total}`;
    el.fill.style.width = `${total ? Math.min(100, (done / total) * 100) : 0}%`;
  }

  function showResult(result: MixResult, stopped: boolean): void {
    el.summary.textContent = summarize(result, stopped);
    el.open.href = new URL(result.url, location.origin).href;
    show("done");
    el.open.focus();
  }

  async function run(
    current: Target,
    name: string,
    seed: string
  ): Promise<void> {
    controller = new AbortController();
    const { signal } = controller;
    const kind = kindOf(current);

    show("progress");

    try {
      const result = await mix({
        target: current,
        name,
        seed,
        keepSections: el.keepSections.checked,
        signal,
        onProgress: (progress) => updateProgress(progress, kind)
      });
      showResult(result, signal.aborted);
    } catch (error) {
      show("form");

      if (!signal.aborted) {
        showError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      controller = null;
    }
  }

  el.launcher.addEventListener("click", () => setCardOpen(true));
  el.close.addEventListener("click", () => setCardOpen(false));
  el.cancel.addEventListener("click", () => controller?.abort());
  el.again.addEventListener("click", () => {
    show("form");
    el.name.focus();
  });
  el.name.addEventListener("input", () => {
    el.name.removeAttribute("aria-invalid");
    el.error.hidden = true;
  });
  el.card.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setCardOpen(false);
    }
  });
  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = el.name.value.trim();

    if (!target || !name) {
      showError("give the new one a name first");
      return;
    }

    void run(target, name, el.seed.value.trim());
  });

  return {
    setBoardPath(path) {
      loading?.abort();
      loading = null;
      target = null;

      if (!controller) {
        setCardOpen(false);
      }

      if (!path) {
        return;
      }

      loading = new AbortController();
      getTarget(path, loading.signal)
        .then((loaded) => {
          const kind = kindOf(loaded);
          const label = loaded.section?.title ?? loaded.board.name;

          target = loaded;
          el.launcherLabel.textContent = `shuffle this ${kind}`;
          el.eyebrow.textContent = `shuffle ${kind}`;
          el.title.textContent = label;
          el.subtitle.textContent = describe(loaded);
          el.nameLabel.textContent = `new ${kind} name`;
          el.name.value = `${label} shuffled`;
          el.keepSectionsField.hidden =
            !!loaded.section || loaded.board.sectionCount === 0;
          el.open.textContent = `open new ${kind}`;

          if (!controller) {
            show("form");
            setCardOpen(false);
          }
        })
        .catch(() => undefined);
    }
  };
}
