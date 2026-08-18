import { App, TAbstractFile } from "obsidian";
import { StoneGateSettings, ProtectedPath } from "../types";
import { LockOverlay } from "../overlay";
import { IdleManager } from "./idle-manager";
import { GhostManager } from "./ghost-manager";

type StateChangeCallback = (locked: boolean) => void;

export class LockManager {
  private app: App;
  private settings: StoneGateSettings;
  private overlay: LockOverlay;
  
  private idleManager: IdleManager;
  private ghostManager: GhostManager;

  // pathId -> timestamp when last unlocked
  private unlockedPaths: Map<string, number> = new Map();
  private previousFile: string | null = null;

  private onStateChangeCallbacks: StateChangeCallback[] = [];

  constructor(app: App, settings: StoneGateSettings, overlay: LockOverlay) {
    this.app = app;
    this.settings = settings;
    this.overlay = overlay;

    this.idleManager = new IdleManager(app, settings, {
      onIdleLock: () => {
        this.checkTimeouts();
      },
      onBlurLock: (currentFilePath: string | null) => {
        // Lock all paths
        this.lockAll();

        // If there is an active file, trigger the lock overlay so it is ready when they return
        if (currentFilePath) {
          this.triggerLock(currentFilePath);
        } else {
          // If no active file but we locked everything, trigger lock on the default path
          const defaultPath = this.settings.protectedPaths.find(p => p.id === "default" || p.path === "/");
          if (defaultPath && (defaultPath.passwordHash || this.settings.passwordHash)) {
            if (!this.overlay.isVisible()) {
              this.overlay.show(defaultPath, this.previousFile, (success) => {
                if (success) {
                  this.handleUnlockSuccess(defaultPath.id);
                }
              });
            }
          }
        }
      }
    });

    this.ghostManager = new GhostManager(settings, (path: string) => this.isLocked(path));
  }

  public handleUnlockSuccess(pathId: string) {
    this.idleManager.recordActivity();
    this.unlock(pathId);
    const unlockedPath = this.settings.protectedPaths.find(p => p.id === pathId);
    // If this path doesn't have its own separate password, it was verified
    // using the shared master password — so unlock every other path that
    // also relies on the shared master password (no password of its own),
    // since the user just proved they know it.
    if (unlockedPath && !unlockedPath.passwordHash) {
      for (const p of this.settings.protectedPaths) {
        if (p.id !== pathId && !p.passwordHash) {
          this.unlock(p.id);
        }
      }
    }
  }

  updateSettings(settings: StoneGateSettings) {
    this.settings = settings;
    this.idleManager.updateSettings(settings);
    this.ghostManager.updateSettings(settings);
    // Check if any paths should lock due to new settings
    this.checkTimeouts();
  }

  private checkTimeouts() {
    const now = Date.now();
    const lastActivity = this.idleManager.getLastActivityTime();
    let lockOccurred = false;

    for (const path of this.settings.protectedPaths) {
      const idleTimeMinutes = (now - lastActivity) / 1000 / 60;
      
      if (idleTimeMinutes >= path.timeoutMinutes) {
        if (this.unlockedPaths.has(path.id)) {
          this.unlockedPaths.delete(path.id);
          lockOccurred = true;
        }
      }
    }

    if (lockOccurred) {
      this.notifyStateChange(true);
      this.ghostManager.updateStyles();
    }
    
    const currentFile = this.app.workspace.getActiveFile();
    if (currentFile && this.isLocked(currentFile.path)) {
      const matchingPath = this.getMatchingPath(currentFile.path);
      if (matchingPath) {
        const idleTimeMinutes = (now - lastActivity) / 1000 / 60;
        if (idleTimeMinutes >= matchingPath.timeoutMinutes) {
          if (!this.overlay.isVisible()) {
            this.triggerLock(currentFile.path);
          }
        }
      }
    }
  }

  public getMatchingPath(filePath: string): ProtectedPath | null {
    // Return the deepest matching protected path
    let match: ProtectedPath | null = null;
    let longestPathLength = -1;

    for (const p of this.settings.protectedPaths) {
      if (p.path === "" || p.path === "/") {
        if (longestPathLength < 0) {
          match = p;
          longestPathLength = 0;
        }
      } else if (filePath === p.path || filePath.startsWith(p.path + "/")) {
        if (p.path.length > longestPathLength) {
          match = p;
          longestPathLength = p.path.length;
        }
      }
    }
    return match;
  }

  public getPreviousFile(): string | null {
    return this.previousFile;
  }

  public setPreviousFile(filePath: string | null) {
    this.previousFile = filePath;
  }

  public isLocked(filePath: string): boolean {
    if (!this.settings.enabled) return false;
    
    const matchingPath = this.getMatchingPath(filePath);
    if (!matchingPath) return false; // Not protected

    if (!matchingPath.passwordHash && !this.settings.passwordHash) return false;

    return !this.unlockedPaths.has(matchingPath.id);
  }

  public triggerLock(filePath: string) {
    if (!this.settings.enabled) return;
    
    const matchingPath = this.getMatchingPath(filePath);
    if (!matchingPath) return;

    if (!matchingPath.passwordHash && !this.settings.passwordHash) return;

    if (this.overlay.isVisible()) return;

    this.overlay.show(matchingPath, this.previousFile, (success: boolean) => {
      if (success) {
        this.handleUnlockSuccess(matchingPath.id);
      } else {
        // Failed unlock, navigate away? We keep it locked.
        // If they hit escape, we shouldn't get here because we block escape.
      }
    });
  }

  public unlock(pathId: string) {
    const now = Date.now();
    this.unlockedPaths.set(pathId, now);
    const pathObj = this.settings.protectedPaths.find(p => p.id === pathId);
    if (pathObj) {
      pathObj.lastUnlocked = now;
    }
    this.notifyStateChange(false);
    this.ghostManager.updateStyles();
  }

  public lock(pathId: string) {
    this.unlockedPaths.delete(pathId);
    this.notifyStateChange(true);
    this.ghostManager.updateStyles();
  }

  public lockAll() {
    this.unlockedPaths.clear();
    this.notifyStateChange(true);
    this.ghostManager.updateStyles();
  }

  public onLockStateChange(callback: StateChangeCallback) {
    this.onStateChangeCallbacks.push(callback);
  }

  private notifyStateChange(locked: boolean) {
    for (const cb of this.onStateChangeCallbacks) {
      cb(locked);
    }
  }

  public handleFileOpen(file: TAbstractFile | null) {
    if (!file) return;
    // Navigating between files counts as user activity
    this.idleManager.recordActivity();
    if (this.isLocked(file.path)) {
      this.triggerLock(file.path);
    }
  }

  public updateGhostModeStyles() {
    this.ghostManager.updateStyles();
  }

  public dispose() {
    this.idleManager.dispose();
    this.ghostManager.dispose();
  }
}
