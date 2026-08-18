import { debounce } from "obsidian";
import { StoneGateSettings } from "../types";

export class GhostManager {
  private settings: StoneGateSettings;
  private isLocked: (path: string) => boolean;

  private ghostModeObserver: MutationObserver | null = null;
  private debouncedUpdateGhostMode: () => void;

  constructor(settings: StoneGateSettings, isLocked: (path: string) => boolean) {
    this.settings = settings;
    this.isLocked = isLocked;

    this.debouncedUpdateGhostMode = debounce(this.updateGhostModeDOM.bind(this), 100, true);
    this.updateStyles();
  }

  public updateSettings(settings: StoneGateSettings) {
    this.settings = settings;
    this.updateStyles();
  }

  public updateStyles() {
    if (!this.settings.enabled) {
      if (this.ghostModeObserver) {
        this.ghostModeObserver.disconnect();
        this.ghostModeObserver = null;
      }
      this.clearGhostModeAttributes();
      return;
    }

    if (!this.ghostModeObserver) {
      // NOTE: raw DOM MutationObserver required because Obsidian does not provide an API to hide specific file/folder tree items
      this.ghostModeObserver = new MutationObserver(() => {
        this.debouncedUpdateGhostMode();
      });
      this.ghostModeObserver.observe(activeDocument.body, { childList: true, subtree: true });
    }

    this.updateGhostModeDOM();
  }

  private clearGhostModeAttributes() {
    const els = activeDocument.querySelectorAll("[data-sg-ghost]");
    els.forEach(el => el.removeAttribute("data-sg-ghost"));
  }

  private updateGhostModeDOM() {
    if (!this.settings.enabled) {
      this.clearGhostModeAttributes();
      return;
    }

    const lockedPaths = new Set<string>();
    for (const path of this.settings.protectedPaths) {
      if (path.path === "/" || path.path === "") continue; // Skip root path
      if (path.enableGhostMode && this.isLocked(path.path)) {
        lockedPaths.add(path.path);
      }
    }

    const titleElements = activeDocument.querySelectorAll(".nav-folder-title[data-path], .nav-file-title[data-path]");
    titleElements.forEach(titleEl => {
      const path = titleEl.getAttribute("data-path");
      const parentEl = titleEl.parentElement;
      if (parentEl && path) {
        if (lockedPaths.has(path)) {
          if (parentEl.getAttribute("data-sg-ghost") !== "true") {
            parentEl.setAttribute("data-sg-ghost", "true");
          }
        } else {
          if (parentEl.hasAttribute("data-sg-ghost")) {
            parentEl.removeAttribute("data-sg-ghost");
          }
        }
      }
    });
  }

  public dispose() {
    if (this.ghostModeObserver) {
      this.ghostModeObserver.disconnect();
      this.ghostModeObserver = null;
    }
    this.clearGhostModeAttributes();
  }
}
