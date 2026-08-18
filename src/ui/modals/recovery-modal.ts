import { App, Modal, Notice } from "obsidian";
import { LockScreenSettings } from "../../types";
import { verifyPassword } from "../../crypto";

export class RecoveryCodeDisplayModal extends Modal {
  private code: string;

  constructor(app: App, code: string) {
    super(app);
    this.code = code;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: "🔑 Secure Recovery Code Generated", cls: "sg-modal-title" });
    
    const desc = contentEl.createEl("p", {
      text: "This recovery code acts as a Global Skeleton Key. It can bypass and unlock any locked folder or the vault itself if you forget your password.",
      cls: "sg-modal-desc"
    });
    desc.addClass("sg-display-desc");

    const warningBox = contentEl.createDiv("sg-warning-box sg-display-warning-box");
    
    warningBox.createEl("strong", { text: "⚠️ IMPORTANT WARNING:", cls: "sg-display-warning-title" });

    warningBox.createEl("span", {
      text: "Write this code down or save it in a secure password manager. For security reasons, the code is hashed before saving, and it CANNOT be shown or recovered again once you close this window.",
      cls: "sg-display-warning-text"
    });

    const codeContainer = contentEl.createDiv("sg-recovery-code-container sg-display-code-container");

    codeContainer.createEl("div", { text: this.code, cls: "sg-display-code-el" });

    const buttonRow = contentEl.createDiv("sg-button-row sg-display-button-row");

    const copyBtn = buttonRow.createEl("button", { text: "Copy Code", cls: "mod-cta" });
    copyBtn.addEventListener("click", () => {
      void (async () => {
        await navigator.clipboard.writeText(this.code);
        new Notice("Recovery code copied to clipboard!");
        copyBtn.setText("Copied!");
        window.setTimeout(() => copyBtn.setText("Copy Code"), 2000);
      })();
    });

    const closeBtn = buttonRow.createEl("button", { text: "Done / I Saved It" });
    closeBtn.addEventListener("click", () => {
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class RecoveryBypassModal extends Modal {
  private settings: LockScreenSettings;
  private onResult: (verified: boolean) => void;
  private onCloseCallback?: () => void;

  constructor(app: App, settings: LockScreenSettings, onResult: (verified: boolean) => void, onCloseCallback?: () => void) {
    super(app);
    this.settings = settings;
    this.onResult = onResult;
    this.onCloseCallback = onCloseCallback;
  }

  onOpen() {
    this.containerEl.addClass("sg-recovery-modal-container");
    this.containerEl.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });

    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "🔑 Emergency Recovery Bypass" });

    contentEl.createEl("p", {
      text: "You are currently locked out. Enter your 6-character Recovery Code to immediately bypass the lockout and unlock.",
      cls: "sg-recovery-desc"
    });

    const inputWrapper = contentEl.createDiv("sg-recovery-input-wrapper");

    const input = inputWrapper.createEl("input", {
      type: "text",
      cls: "sg-recovery-input",
      attr: {
        placeholder: "XXXXXX",
        maxlength: "6",
        autocomplete: "off",
        spellcheck: "false"
      }
    });

    input.addEventListener("input", () => {
      const pos = input.selectionStart ?? input.value.length;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(pos, pos);
    });

    const errorEl = contentEl.createDiv("sg-recovery-error");

    const btnRow = contentEl.createDiv("sg-recovery-btn-row");

    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    const unlockBtn = btnRow.createEl("button", { text: "Use Recovery Code", cls: "mod-cta" });

    let submitted = false;

    const attempt = async () => {
      if (submitted) return;
      errorEl.textContent = "";

      const code = input.value.trim().toUpperCase();
      if (!code) {
        errorEl.textContent = "Please enter your Recovery Code.";
        return;
      }

      unlockBtn.disabled = true;
      unlockBtn.textContent = "Verifying…";

      const isMatch = await verifyPassword(
        code,
        this.settings.recoveryCodeHash!,
        this.settings.recoveryCodeSalt!
      );

      if (isMatch) {
        submitted = true;
        this.close();
        this.onResult(true);
      } else {
        unlockBtn.disabled = false;
        unlockBtn.textContent = "Use Recovery Code";
        errorEl.textContent = "Invalid Recovery Code. Please check and try again.";
        input.value = "";
        new Notice("❌ Invalid Recovery Code.", 4000);
      }
    };

    unlockBtn.addEventListener("click", () => { void attempt(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void attempt();
      }
    });

    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    window.setTimeout(() => input.focus(), 80);
  }

  onClose() {
    this.contentEl.empty();
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }
}
