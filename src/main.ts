import { parseBoardPath } from "./board-page.ts";
import { mountPanel } from "./panel.ts";

const panel = mountPanel();
let currentPath = "";

function syncWithLocation(): void {
  if (location.pathname === currentPath) {
    return;
  }

  currentPath = location.pathname;
  panel.setBoardPath(parseBoardPath(currentPath));
}

new MutationObserver(syncWithLocation).observe(document.body, {
  childList: true,
  subtree: true
});
syncWithLocation();
