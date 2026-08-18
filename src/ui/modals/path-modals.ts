import { App, Modal, TFolder, TFile, setIcon } from "obsidian";
import type StoneGatePlugin from "../../main";
import { ProtectedPath } from "../../types";
import { PasswordModal, ConfirmPasswordModal } from "./password-modal";

type PathEntry = { path: string; type: "vault" | "folder" | "file" };

export class AddPathModal extends Modal {
  plugin: StoneGatePlugin;
  onSubmit: (success: boolean) => void;
  private handleOutsideClick?: (e: MouseEvent) => void;

  constructor(app: App, plugin: StoneGatePlugin, onSubmit: (success: boolean) => void) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Protected Path" });

    // Path Input with Autocomplete
    const pathWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    pathWrapper.createEl("label", { text: "Folder or file path (e.g. Secret/, Notes/todo.md, or / for entire vault)" });
    
    const pathInput = pathWrapper.createEl("input", { type: "text", attr: { placeholder: "Path..." } });
    
    const dropdown = pathWrapper.createDiv("sg-autocomplete-dropdown");
    dropdown.hide();

    const allEntries: PathEntry[] = [
      { path: "/", type: "vault" },
      ...this.app.vault.getAllFolders().map(f => ({ path: f.path, type: "folder" as const })),
      ...this.app.vault.getFiles().map(f => ({ path: f.path, type: "file" as const })),
    ];
    
    let selectedIndex = -1;
    let currentMatches: PathEntry[] = [];
    let items: HTMLElement[] = [];
    let applyHighlight = () => {};

    const updateDropdown = () => {
      dropdown.empty();
      items = [];
      const rawQuery = pathInput.value.toLowerCase().trim();
      const query = rawQuery.replace(/^\/+/, "");
      const matches = allEntries.filter(entry => {
        const searchableText = entry.path === "/" ? "vault /" : entry.path.toLowerCase();
        return searchableText.includes(query) || (rawQuery.length > 0 && searchableText.includes(rawQuery));
      }).slice(0, 8);
      
      currentMatches = matches;
      selectedIndex = matches.length > 0 ? 0 : -1;

      if (matches.length > 0 && rawQuery.length > 0) {
        dropdown.show();
        for (const match of matches) {
          const item = dropdown.createDiv({ cls: "sg-autocomplete-item" });
          const iconSpan = item.createSpan({ cls: "sg-path-type-icon" });
          setIcon(iconSpan, match.type === "vault" ? "home" : match.type === "folder" ? "folder" : "file");
          item.createSpan({ text: match.path === "/" ? "Vault (/)" : match.path });
          item.addEventListener("click", () => {
            pathInput.value = match.path;
            dropdown.hide();
            currentMatches = [];
            selectedIndex = -1;
          });
          items.push(item);
        }
        applyHighlight = () => {
          items.forEach((el, i) => el.toggleClass("sg-autocomplete-item-active", i === selectedIndex));
        };
        applyHighlight();
      } else {
        dropdown.hide();
        currentMatches = [];
        selectedIndex = -1;
      }
    };

    pathInput.addEventListener("input", updateDropdown);

    pathInput.addEventListener("keydown", (e: KeyboardEvent) => {
      const isDropdownVisible = dropdown.style.display !== "none" && currentMatches.length > 0;

      if (isDropdownVisible && e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentMatches.length - 1);
        applyHighlight();
        items[selectedIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (isDropdownVisible && e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        applyHighlight();
        items[selectedIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (isDropdownVisible && e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const chosen = currentMatches[selectedIndex];
        pathInput.value = chosen.path;
        dropdown.hide();
        currentMatches = [];
        selectedIndex = -1;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });

    // Label Input
    const labelWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    labelWrapper.createEl("label", { text: "Friendly Label (optional)" });
    const labelInput = labelWrapper.createEl("input", { type: "text", attr: { placeholder: "My Secrets" } });

    // Timeout Input
    const timeoutWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    timeoutWrapper.createEl("label", { text: "Timeout in Minutes (decimals allowed, e.g., 0.5 = 30s)" });
    const timeoutInput = timeoutWrapper.createEl("input", { type: "number", attr: { placeholder: "Minutes (e.g. 0.5 = 30s, 3 = 3min)", step: "any" } });
    timeoutInput.value = "3";

    // Ghost mode toggle
    const ghostWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const ghostToggle = ghostWrapper.createEl("input", { type: "checkbox" });
    const ghostLabel = ghostWrapper.createEl("span", { text: "Enable Ghost Mode (Hide this path from File Explorer)" });
    ghostLabel.addEventListener("click", () => ghostToggle.click());

    // Show in Unlock Menu toggle
    const menuWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const menuToggle = menuWrapper.createEl("input", { type: "checkbox" });
    const menuLabel = menuWrapper.createEl("span", { text: "Show in Unlock Menu" });
    menuLabel.addEventListener("click", () => {
      if (!menuToggle.disabled) {
        menuToggle.click();
      }
    });

    // Description text for the new toggle
    contentEl.createEl("p", {
      text: "If enabled, this path will be listed in the Unlock Menu. Note: Paths with Ghost Mode enabled are ALWAYS listed.",
      cls: "sg-modal-desc-small"
    });

    // Enforce dependency logic
    ghostToggle.addEventListener("change", () => {
      if (ghostToggle.checked) {
        menuToggle.checked = true;
        menuToggle.disabled = true;
      } else {
        menuToggle.disabled = false;
      }
    });

    // Set path password
    let tempHash: string | undefined = undefined;
    let tempSalt: string | undefined = undefined;
    const pwdBtn = contentEl.createEl("button", { text: "Set Password for this path (optional)", cls: "sg-path-password-btn" });
    pwdBtn.addEventListener("click", () => {
      new PasswordModal(this.app, this.plugin, undefined, undefined, "Path Password", (success, hash, salt) => {
        if (success && hash && salt) {
          tempHash = hash;
          tempSalt = salt;
          pwdBtn.textContent = "Path password set ✓";
        }
      }).open();
    });

    // Hint Section (placed below password button)
    const hintWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    hintWrapper.createEl("label", { text: "Password Hint (optional)" });
    const hintInput = hintWrapper.createEl("input", { type: "text", attr: { placeholder: "Hint or custom message..." } });

    const toggleWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const showHintToggle = toggleWrapper.createEl("input", { type: "checkbox" });
    const showHintLabel = toggleWrapper.createEl("span", { text: "Show hint on lock screen" });
    showHintLabel.addEventListener("click", () => showHintToggle.click());

    const errorEl = contentEl.createDiv("sg-error");

    const submitBtn = contentEl.createEl("button", { text: "Add", cls: "mod-cta sg-modal-submit-btn" });

    const submit = async () => {
      errorEl.textContent = "";
      const pathVal = pathInput.value.trim();
      const labelVal = labelInput.value.trim();
      const timeoutVal = parseFloat(timeoutInput.value);

      if (!pathVal) {
        errorEl.textContent = "Path cannot be empty.";
        return;
      }
      
      if (isNaN(timeoutVal) || timeoutVal < 0) {
        errorEl.textContent = "Timeout must be a positive number.";
        return;
      }
      
      if (this.plugin.settings.protectedPaths.some(p => p.path === pathVal)) {
        errorEl.textContent = "Path is already protected.";
        return;
      }

      this.plugin.settings.protectedPaths.push({
        id: "path-" + Date.now(),
        path: pathVal,
        label: labelVal || undefined,
        timeoutMinutes: timeoutVal,
        passwordHash: tempHash,
        passwordSalt: tempSalt,
        passwordHint: hintInput.value.trim() || undefined,
        showHint: showHintToggle.checked,
        enableGhostMode: ghostToggle.checked,
        showInUnlockMenu: menuToggle.checked
      });
      
      await this.plugin.saveSettings();
      this.onSubmit(true);
      this.close();
    };

    submitBtn.addEventListener("click", () => { void submit(); });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    labelInput.addEventListener("keydown", handleKey);
    timeoutInput.addEventListener("keydown", handleKey);

    // Close dropdown when clicking outside
    this.handleOutsideClick = (e: MouseEvent) => {
      if (!pathWrapper.contains(e.target as Node)) {
        dropdown.hide();
        currentMatches = [];
        selectedIndex = -1;
      }
    };
    activeDocument.addEventListener("click", this.handleOutsideClick);

    window.setTimeout(() => pathInput.focus(), 50);
  }

  onClose() {
    if (this.handleOutsideClick) {
      activeDocument.removeEventListener("click", this.handleOutsideClick);
      this.handleOutsideClick = undefined;
    }
    this.contentEl.empty();
  }
}

export class EditPathModal extends Modal {
  plugin: StoneGatePlugin;
  pathObj: ProtectedPath;
  onSubmit: (success: boolean) => void;

  constructor(app: App, plugin: StoneGatePlugin, pathObj: ProtectedPath, onSubmit: (success: boolean) => void) {
    super(app);
    this.plugin = plugin;
    this.pathObj = pathObj;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Edit Protected Path" });

    const isRoot = this.pathObj.path === "/" || this.pathObj.path === "";
    const abstractFile = isRoot ? null : this.app.vault.getAbstractFileByPath(this.pathObj.path);
    const iconName = isRoot ? "home" : abstractFile instanceof TFolder ? "folder" : abstractFile instanceof TFile ? "file" : "help-circle";

    const pathLine = contentEl.createEl("p");
    pathLine.createSpan({ text: "Path: " });
    const iconSpan = pathLine.createSpan({ cls: "sg-path-type-icon" });
    setIcon(iconSpan, iconName);
    pathLine.createSpan({ text: isRoot ? "Vault (/)" : this.pathObj.path });

    // Label Input
    const labelWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    labelWrapper.createEl("label", { text: "Friendly Label" });
    const labelInput = labelWrapper.createEl("input", { type: "text", attr: { placeholder: "Label" } });
    labelInput.value = this.pathObj.label || "";

    // Timeout Input
    const timeoutWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    timeoutWrapper.createEl("label", { text: "Timeout in Minutes (decimals allowed, e.g., 0.5 = 30s)" });
    const timeoutInput = timeoutWrapper.createEl("input", { type: "number", attr: { placeholder: "Minutes", step: "any" } });
    timeoutInput.value = String(this.pathObj.timeoutMinutes);

    // Ghost mode toggle
    const ghostWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const ghostToggle = ghostWrapper.createEl("input", { type: "checkbox" });
    ghostToggle.checked = !!this.pathObj.enableGhostMode;
    const ghostLabel = ghostWrapper.createEl("span", { text: "Enable Ghost Mode (Hide this path from File Explorer)" });
    ghostLabel.addEventListener("click", () => ghostToggle.click());

    // Show in Unlock Menu toggle
    const menuWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const menuToggle = menuWrapper.createEl("input", { type: "checkbox" });
    menuToggle.checked = !!this.pathObj.showInUnlockMenu;
    const menuLabel = menuWrapper.createEl("span", { text: "Show in Unlock Menu" });
    menuLabel.addEventListener("click", () => {
      if (!menuToggle.disabled) {
        menuToggle.click();
      }
    });

    // Description text for the new toggle
    contentEl.createEl("p", {
      text: "If enabled, this path will be listed in the Unlock Menu. Note: Paths with Ghost Mode enabled are ALWAYS listed.",
      cls: "sg-modal-desc-small"
    });

    // Enforce initial disabled state if Ghost Mode was already enabled
    if (ghostToggle.checked) {
      menuToggle.checked = true;
      menuToggle.disabled = true;
    }

    // Enforce dependency logic
    ghostToggle.addEventListener("change", () => {
      if (ghostToggle.checked) {
        menuToggle.checked = true;
        menuToggle.disabled = true;
      } else {
        menuToggle.disabled = false;
      }
    });

    const pwdControls = contentEl.createDiv("sg-modal-button-row-left");

    const pwdBtn = pwdControls.createEl("button", { text: this.pathObj.passwordHash ? "Change Path Password" : "Set Path Password" });
    pwdBtn.addEventListener("click", () => {
      new PasswordModal(this.app, this.plugin, this.pathObj.passwordHash, this.pathObj.passwordSalt, "Path Password", (success, hash, salt) => {
        void (async () => {
          if (success && hash && salt) {
            this.pathObj.passwordHash = hash;
            this.pathObj.passwordSalt = salt;
            await this.plugin.saveSettings();
            this.onSubmit(true);
            this.close();
          }
        })();
      }).open();
    });

    if (this.pathObj.passwordHash) {
      const rmPwdBtn = pwdControls.createEl("button", { text: "Remove Path Password", cls: "mod-warning" });
      rmPwdBtn.addEventListener("click", () => {
        new ConfirmPasswordModal(this.app, this.plugin, this.pathObj.passwordHash, this.pathObj.passwordSalt, "Path Password", (success) => {
          void (async () => {
            if (success) {
              this.pathObj.passwordHash = undefined;
              this.pathObj.passwordSalt = undefined;
              await this.plugin.saveSettings();
              this.onSubmit(true);
              this.close();
            }
          })();
        }).open();
      });
    }

    // Hint Section (placed below password button)
    const hintWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-small-margin" });
    hintWrapper.createEl("label", { text: "Password Hint" });
    const hintInput = hintWrapper.createEl("input", { type: "text", attr: { placeholder: "Hint or custom message..." } });
    hintInput.value = this.pathObj.passwordHint || "";

    const toggleWrapper = contentEl.createDiv({ cls: "sg-modal-input-container sg-flex-row" });
    const showHintToggle = toggleWrapper.createEl("input", { type: "checkbox" });
    showHintToggle.checked = this.pathObj.showHint;
    const showHintLabel = toggleWrapper.createEl("span", { text: "Show hint on lock screen" });
    showHintLabel.addEventListener("click", () => showHintToggle.click());

    const errorEl = contentEl.createDiv("sg-error");

    const controls = contentEl.createDiv("sg-modal-button-row-right");

    const submitBtn = controls.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = controls.createEl("button", { text: "Cancel" });

    const submit = async () => {
      errorEl.textContent = "";
      const labelVal = labelInput.value.trim();
      const timeoutVal = parseFloat(timeoutInput.value);

      if (isNaN(timeoutVal) || timeoutVal < 0) {
        errorEl.textContent = "Timeout must be a positive number.";
        return;
      }

      this.pathObj.label = labelVal || undefined;
      this.pathObj.timeoutMinutes = timeoutVal;
      this.pathObj.passwordHint = hintInput.value.trim() || undefined;
      this.pathObj.showHint = showHintToggle.checked;
      this.pathObj.enableGhostMode = ghostToggle.checked;
      this.pathObj.showInUnlockMenu = menuToggle.checked;
      
      await this.plugin.saveSettings();
      this.plugin.lockManager.updateGhostModeStyles();
      this.onSubmit(true);
      this.close();
    };

    submitBtn.addEventListener("click", () => { void submit(); });
    cancelBtn.addEventListener("click", () => this.close());
    
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    labelInput.addEventListener("keydown", handleKey);
    timeoutInput.addEventListener("keydown", handleKey);
    hintInput.addEventListener("keydown", handleKey);

    window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}
