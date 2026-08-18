import { App, Modal, setIcon } from "obsidian";
import type StoneGatePlugin from "../../main";
import { verifyPassword, generateSalt, hashPassword, uint8ArrayToBase64 } from "../../crypto";

export function createInputWithEye(container: HTMLElement, placeholder: string): HTMLInputElement {
  const wrapper = container.createDiv("sg-modal-input-container");
  const input = wrapper.createEl("input", { type: "password", attr: { placeholder } });
  
  const eyeBtn = wrapper.createEl("button", { cls: "sg-eye-toggle" });
  setIcon(eyeBtn, "eye");
  eyeBtn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    if (isPassword) {
      setIcon(eyeBtn, "eye-off");
    } else {
      setIcon(eyeBtn, "eye");
    }
  });
  return input;
}

export class PasswordModal extends Modal {
  plugin: StoneGatePlugin;
  onSubmit: (success: boolean, hash?: string, salt?: string) => void;
  targetHash?: string;
  targetSalt?: string;
  targetName: string;

  constructor(app: App, plugin: StoneGatePlugin, targetHash: string | undefined, targetSalt: string | undefined, targetName: string, onSubmit: (success: boolean, hash?: string, salt?: string) => void) {
    super(app);
    this.plugin = plugin;
    this.targetHash = targetHash;
    this.targetSalt = targetSalt;
    this.targetName = targetName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.targetHash ? `Change ${this.targetName}` : `Set ${this.targetName}` });

    let currentInput: HTMLInputElement | undefined;
    if (this.targetHash) {
      currentInput = createInputWithEye(contentEl, "Current Password");
    }

    const newPasswordInput = createInputWithEye(contentEl, "New Password");
    const confirmPasswordInput = createInputWithEye(contentEl, "Confirm Password");
    const errorEl = contentEl.createDiv("sg-error");

    const submitBtn = contentEl.createEl("button", { text: "Save", cls: "mod-cta sg-modal-submit-btn" });

    const submit = async () => {
      errorEl.textContent = "";
      if (currentInput) {
        currentInput.setCssStyles({ borderColor: "" });
      }
      if (currentInput && this.targetHash && this.targetSalt) {
        const isMatch = await verifyPassword(currentInput.value, this.targetHash, this.targetSalt);
        if (!isMatch) {
          errorEl.textContent = "Current password is incorrect.";
          currentInput.value = "";
          currentInput.setCssStyles({ borderColor: "#e05555" });
          return;
        }
      }

      const p1 = newPasswordInput.value;
      const p2 = confirmPasswordInput.value;

      const asciiRegex = new RegExp("^[" + String.fromCharCode(0) + "-\\u007F]*$");
      if (!p1 || p1.length < 4 || !asciiRegex.test(p1)) {
        errorEl.textContent = "Password must be at least 4 ASCII characters.";
        return;
      }

      if (p1 !== p2) {
        errorEl.textContent = "Passwords do not match.";
        return;
      }

      const salt = generateSalt();
      const hash = await hashPassword(p1, salt);
      this.onSubmit(true, hash, uint8ArrayToBase64(salt));
      this.close();
    };

    submitBtn.addEventListener("click", () => { void submit(); });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    newPasswordInput.addEventListener("keydown", handleKey);
    confirmPasswordInput.addEventListener("keydown", handleKey);
    if (currentInput) currentInput.addEventListener("keydown", handleKey);
    
    window.setTimeout(() => {
      if (currentInput) currentInput.focus();
      else newPasswordInput.focus();
    }, 50);
  }

  onClose() {
    this.contentEl.empty();
    this.onSubmit(false);
  }
}

export class ConfirmPasswordModal extends Modal {
  plugin: StoneGatePlugin;
  onSubmit: (success: boolean) => void;
  targetHash?: string;
  targetSalt?: string;
  targetName: string;
  hint?: string;

  constructor(app: App, plugin: StoneGatePlugin, targetHash: string | undefined, targetSalt: string | undefined, targetName: string, onSubmit: (success: boolean) => void, hint?: string) {
    super(app);
    this.plugin = plugin;
    this.targetHash = targetHash;
    this.targetSalt = targetSalt;
    this.targetName = targetName;
    this.onSubmit = onSubmit;
    this.hint = hint;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Confirm ${this.targetName}` });
    contentEl.createEl("p", { text: "Please enter the password to continue." });

    const input = createInputWithEye(contentEl, "Password");

    // Display hint if provided
    if (this.hint) {
      const hintEl = contentEl.createDiv("sg-hint");
      hintEl.textContent = this.hint;
    }

    const errorEl = contentEl.createDiv("sg-error");

    const submitBtn = contentEl.createEl("button", { text: "Confirm", cls: "mod-cta sg-modal-submit-btn" });

    const submit = async () => {
      errorEl.textContent = "";
      input.setCssStyles({ borderColor: "" });
      const hash = this.targetHash || this.plugin.settings.passwordHash;
      const salt = this.targetSalt || this.plugin.settings.passwordSalt;
      if (!hash || !salt) {
        this.onSubmit(true);
        this.close();
        return;
      }

      const isMatch = await verifyPassword(input.value, hash, salt);
      if (isMatch) {
        this.onSubmit(true);
        this.close();
      } else {
        errorEl.textContent = "Incorrect password.";
        input.value = "";
        input.setCssStyles({ borderColor: "#e05555" });
      }
    };

    submitBtn.addEventListener("click", () => { void submit(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });
    window.setTimeout(() => input.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
    this.onSubmit(false);
  }
}
