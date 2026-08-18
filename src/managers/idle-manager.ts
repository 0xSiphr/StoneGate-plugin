import { App } from "obsidian";
import { StoneGateSettings } from "../types";

export interface IdleManagerCallbacks {
  onIdleLock: () => void;
  onBlurLock: (currentFilePath: string | null) => void;
}

export class IdleManager {
  private app: App;
  private settings: StoneGateSettings;
  private callbacks: IdleManagerCallbacks;

  private idleTimerId: number | null = null;
  private blurTimerId: number | null = null;
  private lastActivityTime = Date.now();

  private boundActivityHandler = this.throttleActivity.bind(this);
  private boundBlurHandler = this.handleWindowBlur.bind(this);
  private boundFocusHandler = this.handleWindowFocus.bind(this);

  // Used for throttling activity updates (max once per second)
  private activityUpdatePending = false;

  constructor(app: App, settings: StoneGateSettings, callbacks: IdleManagerCallbacks) {
    this.app = app;
    this.settings = settings;
    this.callbacks = callbacks;

    this.setupListeners();
    this.startIdleChecker();
  }

  public updateSettings(settings: StoneGateSettings) {
    this.settings = settings;
  }

  public recordActivity() {
    this.lastActivityTime = Date.now();
  }

  public getLastActivityTime(): number {
    return this.lastActivityTime;
  }

  private setupListeners() {
    // NOTE: raw DOM event listeners required because Obsidian provides no system-wide idle detection API
    activeDocument.addEventListener("mousemove", this.boundActivityHandler);
    activeDocument.addEventListener("keydown", this.boundActivityHandler);
    activeDocument.addEventListener("mousedown", this.boundActivityHandler);
    activeDocument.addEventListener("touchstart", this.boundActivityHandler);
    window.addEventListener("blur", this.boundBlurHandler);
    window.addEventListener("focus", this.boundFocusHandler);
  }

  private throttleActivity() {
    if (this.activityUpdatePending) return;
    this.activityUpdatePending = true;
    window.setTimeout(() => {
      this.lastActivityTime = Date.now();
      this.activityUpdatePending = false;
    }, 1000);
  }

  private startIdleChecker() {
    // Single recursive setTimeout, runs every 10 seconds
    const check = () => {
      this.callbacks.onIdleLock();
      this.idleTimerId = window.setTimeout(check, 10000);
    };
    this.idleTimerId = window.setTimeout(check, 10000);
  }

  private handleWindowBlur() {
    if (!this.settings.enabled || !this.settings.lockOnBlur) return;

    if (this.blurTimerId !== null) {
      window.clearTimeout(this.blurTimerId);
    }

    const gracePeriod = this.settings.blurGracePeriodSeconds ?? 3;
    if (gracePeriod <= 0) {
      this.executeBlurLock();
    } else {
      this.blurTimerId = window.setTimeout(() => {
        this.executeBlurLock();
        this.blurTimerId = null;
      }, gracePeriod * 1000);
    }
  }

  private handleWindowFocus() {
    if (this.blurTimerId !== null) {
      window.clearTimeout(this.blurTimerId);
      this.blurTimerId = null;
    }
  }

  private executeBlurLock() {
    const currentFile = this.app.workspace.getActiveFile();
    this.callbacks.onBlurLock(currentFile ? currentFile.path : null);
  }

  public dispose() {
    activeDocument.removeEventListener("mousemove", this.boundActivityHandler);
    activeDocument.removeEventListener("keydown", this.boundActivityHandler);
    activeDocument.removeEventListener("mousedown", this.boundActivityHandler);
    activeDocument.removeEventListener("touchstart", this.boundActivityHandler);
    window.removeEventListener("blur", this.boundBlurHandler);
    window.removeEventListener("focus", this.boundFocusHandler);

    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
    }
    if (this.blurTimerId !== null) {
      window.clearTimeout(this.blurTimerId);
    }
  }
}
