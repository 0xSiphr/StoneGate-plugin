import { App, PluginSettingTab, Setting, Notice, ButtonComponent, TFolder, TFile, setIcon } from "obsidian";
import type StoneGatePlugin from "../main";
import { generateSalt, hashPassword, uint8ArrayToBase64, generateRecoveryCode } from "../crypto";
import { PasswordModal, ConfirmPasswordModal } from "../ui/modals/password-modal";
import { AddPathModal, EditPathModal } from "../ui/modals/path-modals";
import { RecoveryCodeDisplayModal } from "../ui/modals/recovery-modal";
import { ImagePathSuggest } from "../ui/suggests/image-suggest";

interface DestructiveButton extends ButtonComponent {
  setDestructive?: () => this;
}

export class StoneGateSettingTab extends PluginSettingTab {
  plugin: StoneGatePlugin;

  constructor(app: App, plugin: StoneGatePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Core").setHeading();

    // --- Protection Enable/Disable ---
    new Setting(containerEl)
      .setName("Enable StoneGate")
      .setDesc("Turn on lock screen protection")
      .addToggle((toggle) => {
        let isSyncing = false;
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange((value) => {
            void (async () => {
              if (isSyncing) return;
              try {
                if (value) {
                  if (!this.plugin.settings.passwordHash) {
                    // Must set password first
                    isSyncing = true;
                    toggle.setValue(false);
                    isSyncing = false;
                    new PasswordModal(this.app, this.plugin, undefined, undefined, "Master Password", (success, hash, salt) => {
                      void (async () => {
                        try {
                          if (success && hash && salt) {
                            this.plugin.settings.passwordHash = hash;
                            this.plugin.settings.passwordSalt = salt;
                            this.plugin.settings.enabled = true;
                            await this.plugin.saveSettings();
                            this.display();
                          } else {
                            isSyncing = true;
                            toggle.setValue(false);
                            isSyncing = false;
                          }
                        } catch (e) {
                          console.error("Password modal callback error:", e);
                        }
                      })();
                    }).open();
                  } else {
                    this.plugin.settings.enabled = true;
                    await this.plugin.saveSettings();
                  }
                } else {
                  // Disabling requires confirmation
                  isSyncing = true;
                  toggle.setValue(true);
                  isSyncing = false;
                  new ConfirmPasswordModal(this.app, this.plugin, this.plugin.settings.passwordHash, this.plugin.settings.passwordSalt, "Master Password", (success) => {
                    void (async () => {
                      try {
                        if (success) {
                          this.plugin.settings.enabled = false;
                          await this.plugin.saveSettings();
                          this.plugin.lockManager.lockAll();
                          this.display();
                        } else {
                          isSyncing = true;
                          toggle.setValue(true);
                          isSyncing = false;
                        }
                      } catch (e) {
                        console.error("Confirm password modal callback error:", e);
                      }
                    })();
                  }).open();
                }
              } catch (e) {
                console.error("Failed to toggle StoneGate:", e);
                isSyncing = true;
                toggle.setValue(!value);
                isSyncing = false;
              }
            })();
          });
      });

    new Setting(containerEl).setName("Master Password").setHeading();

    const passwordSetting = new Setting(containerEl)
      .setName("Password")
      .setDesc("Used to unlock your vault and folders");

    if (this.plugin.settings.passwordHash) {
      passwordSetting
        .addButton((btn) =>
          btn
            .setButtonText("Change Password")
            .onClick(() => {
              new PasswordModal(this.app, this.plugin, this.plugin.settings.passwordHash, this.plugin.settings.passwordSalt, "Master Password", (success, hash, salt) => {
                void (async () => {
                  if (success && hash && salt) {
                    this.plugin.settings.passwordHash = hash;
                    this.plugin.settings.passwordSalt = salt;
                    await this.plugin.saveSettings();
                    this.display();
                  }
                })();
              }).open();
            })
        )
        .addButton((btn) => {
          btn.setButtonText("Remove");
          const dBtn = btn as DestructiveButton;
          if (typeof dBtn.setDestructive === "function") {
            dBtn.setDestructive();
          } else {
            dBtn["setWarning"]?.();
          }
          btn.onClick(() => {
            new ConfirmPasswordModal(this.app, this.plugin, this.plugin.settings.passwordHash, this.plugin.settings.passwordSalt, "Master Password", (success) => {
              void (async () => {
                if (success) {
                  this.plugin.settings.passwordHash = undefined;
                  this.plugin.settings.passwordSalt = undefined;
                  this.plugin.settings.enabled = false; // Disable if no password
                  await this.plugin.saveSettings();
                  this.display();
                }
              })();
            }).open();
          });
        });



    } else {
      passwordSetting.addButton((btn) =>
        btn
          .setButtonText("Set Password")
          .setCta()
          .onClick(() => {
            new PasswordModal(this.app, this.plugin, undefined, undefined, "Master Password", (success, hash, salt) => {
              void (async () => {
                if (success && hash && salt) {
                  this.plugin.settings.passwordHash = hash;
                  this.plugin.settings.passwordSalt = salt;
                  await this.plugin.saveSettings();
                  this.display();
                }
              })();
            }).open();
          })
      );
    }

    new Setting(containerEl).setName("Protected Paths").setHeading();

    new Setting(containerEl)
      .setName("Add Protected Path")
      .setDesc("Select a folder, file, or the whole vault to protect.")
      .addButton((btn) =>
        btn
          .setButtonText("Add Path")
          .setCta()
          .onClick(() => {
            new AddPathModal(this.app, this.plugin, () => this.display()).open();
          })
      );

    const pathsContainer = containerEl.createDiv();
    for (const path of this.plugin.settings.protectedPaths) {
      const isRoot = path.path === "/" || path.path === "";
      const abstractFile = isRoot ? null : this.app.vault.getAbstractFileByPath(path.path);
      const iconName = isRoot ? "home" : abstractFile instanceof TFolder ? "folder" : abstractFile instanceof TFile ? "file" : "help-circle";

      const setting = new Setting(pathsContainer);
      setting.nameEl.empty();
      const iconSpan = setting.nameEl.createSpan({ cls: "sg-path-type-icon" });
      setIcon(iconSpan, iconName);
      setting.nameEl.createSpan({ text: isRoot ? "Vault" : path.path });

      setting
        .setDesc(`${path.label ? path.label + " | " : ""}${path.timeoutMinutes} min timeout${path.passwordHash ? " | 🔑 Has own password" : ""}`)
        .addButton((btn) =>
          btn
            .setButtonText("Edit")
            .onClick(() => {
              new EditPathModal(this.app, this.plugin, path, () => this.display()).open();
            })
        )
        .addButton((btn) =>
          btn
            .setButtonText("Remove")
            .onClick(async () => {
              this.plugin.settings.protectedPaths = this.plugin.settings.protectedPaths.filter((p) => p.id !== path.id);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }

    new Setting(containerEl).setName("Behavior").setHeading();

    new Setting(containerEl)
      .setName("Lock on Startup")
      .setDesc("Require password immediately when opening Obsidian")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.lockOnStartup)
          .onChange((value) => {
            this.plugin.settings.lockOnStartup = value;
            void this.plugin.saveSettings();
          })
      );

    const blurDesc = new DocumentFragment();
    blurDesc.createSpan({ text: "Lock immediately when the window loses focus." });
    blurDesc.createEl("br");
    blurDesc.createSpan({
      text: "Note: opening another app (including screenshot tools) also counts as losing focus, so with this enabled — especially with a Blur Grace Period of 0 — taking a screenshot can immediately lock your vault."
    });

    new Setting(containerEl)
      .setName("Lock when Obsidian loses focus")
      .setDesc(blurDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.lockOnBlur)
          .onChange((value) => {
            this.plugin.settings.lockOnBlur = value;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Blur Grace Period (seconds)")
      .setDesc("Time in seconds to wait before locking after focus loss (0 = immediate)")
      .addText((text) =>
        text
          .setPlaceholder("3")
          .setValue(String(this.plugin.settings.blurGracePeriodSeconds))
          .onChange((value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.blurGracePeriodSeconds = num;
              void this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Max Failed Attempts")
      .setDesc("0 = unlimited")
      .addText((text) =>
        text
          .setPlaceholder("3")
          .setValue(String(this.plugin.settings.maxFailedAttempts))
          .onChange((value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.maxFailedAttempts = num;
              void this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Lockout Duration (seconds)")
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.lockoutDurationSeconds))
          .onChange((value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.lockoutDurationSeconds = num;
              void this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Intruder Alert")
      .setDesc("Show a notice upon unlocking if there were failed attempts")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.intruderAlert)
          .onChange((value) => {
            this.plugin.settings.intruderAlert = value;
            void this.plugin.saveSettings();
          })
      );



    new Setting(containerEl).setName("Ghost Mode & Commands").setHeading();

    const unlockMenuPwdSetting = new Setting(containerEl)
      .setName("Unlock Menu Access Password")
      .setDesc("Used to access the command palette list of hidden/locked paths");

    if (this.plugin.settings.unlockMenuPasswordHash) {
      unlockMenuPwdSetting
        .addButton((btn) =>
          btn
            .setButtonText("Change Password")
            .onClick(() => {
              new PasswordModal(this.app, this.plugin, this.plugin.settings.unlockMenuPasswordHash, this.plugin.settings.unlockMenuPasswordSalt, "Unlock Menu Password", (success, hash, salt) => {
                void (async () => {
                  if (success && hash && salt) {
                    this.plugin.settings.unlockMenuPasswordHash = hash;
                    this.plugin.settings.unlockMenuPasswordSalt = salt;
                    await this.plugin.saveSettings();
                    this.display();
                  }
                })();
              }).open();
            })
        )
        .addButton((btn) => {
          btn.setButtonText("Remove");
          const dBtn = btn as DestructiveButton;
          if (typeof dBtn.setDestructive === "function") {
            dBtn.setDestructive();
          } else {
            dBtn["setWarning"]?.();
          }
          btn.onClick(() => {
            new ConfirmPasswordModal(this.app, this.plugin, this.plugin.settings.unlockMenuPasswordHash, this.plugin.settings.unlockMenuPasswordSalt, "Unlock Menu Password", (success) => {
              void (async () => {
                if (success) {
                  this.plugin.settings.unlockMenuPasswordHash = undefined;
                  this.plugin.settings.unlockMenuPasswordSalt = undefined;
                  await this.plugin.saveSettings();
                  this.display();
                }
              })();
            }).open();
          });
        });
    } else {
      unlockMenuPwdSetting.addButton((btn) =>
        btn
          .setButtonText("Set Password")
          .setCta()
          .onClick(() => {
            new PasswordModal(this.app, this.plugin, undefined, undefined, "Unlock Menu Password", (success, hash, salt) => {
              void (async () => {
                if (success && hash && salt) {
                  this.plugin.settings.unlockMenuPasswordHash = hash;
                  this.plugin.settings.unlockMenuPasswordSalt = salt;
                  await this.plugin.saveSettings();
                  this.display();
                }
              })();
            }).open();
          })
      );
    }

    new Setting(containerEl)
      .setName("Unlock Menu Password Hint")
      .setDesc("Hint shown when the Unlock Menu password is requested")
      .addText((text) =>
        text
          .setPlaceholder("Hint or custom message...")
          .setValue(this.plugin.settings.unlockMenuPasswordHint || "")
          .onChange((value) => {
            this.plugin.settings.unlockMenuPasswordHint = value.trim() || undefined;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Security").setHeading();

    const recoverySetting = new Setting(containerEl)
      .setName("Recovery Code (Global Skeleton Key)")
      .setDesc("A 6-character recovery code that can bypass and unlock any path if you forget your password.");

    if (this.plugin.settings.recoveryCodeHash) {
      recoverySetting
        .setDesc("A recovery code is configured. You can use it to bypass lock screens. (For security, only the hash is stored; the code cannot be shown again).")
        .addButton((btn) => {
          btn.setButtonText("Remove Recovery Code");
          const dBtn = btn as DestructiveButton;
          if (typeof dBtn.setDestructive === "function") {
            dBtn.setDestructive();
          } else {
            dBtn["setWarning"]?.();
          }
          btn.onClick(() => {
            new ConfirmPasswordModal(
              this.app,
              this.plugin,
              undefined,
              undefined,
              "Master Password",
              (success) => {
                void (async () => {
                  if (success) {
                    this.plugin.settings.recoveryCodeHash = undefined;
                    this.plugin.settings.recoveryCodeSalt = undefined;
                    await this.plugin.saveSettings();
                    this.display();
                    new Notice("Recovery Code removed successfully.");
                  }
                })();
              }
            ).open();
          });
        });
    } else {
      recoverySetting.addButton((btn) =>
        btn
          .setButtonText("Generate Recovery Code")
          .setCta()
          .onClick(() => {
            new ConfirmPasswordModal(
              this.app,
              this.plugin,
              undefined,
              undefined,
              "Master Password",
              (success) => {
                void (async () => {
                  if (success) {
                    const code = generateRecoveryCode();
                    const saltBytes = generateSalt();
                    const hash = await hashPassword(code.toUpperCase(), saltBytes);
                    this.plugin.settings.recoveryCodeHash = hash;
                    this.plugin.settings.recoveryCodeSalt = uint8ArrayToBase64(saltBytes);
                    await this.plugin.saveSettings();
                    this.display();
                    new RecoveryCodeDisplayModal(this.app, code).open();
                  }
                })();
              }
            ).open();
          })
      );
    }

    new Setting(containerEl).setName("Appearance").setHeading();

    new Setting(containerEl)
      .setName("Show StoneGate Title")
      .setDesc("Show the 'StoneGate' app name at the top of the lock screen")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showStoneGateTitle)
          .onChange((value) => {
            this.plugin.settings.showStoneGateTitle = value;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Custom Lock Screen Title")
      .setDesc("Custom text to show at the top of the lock screen (defaults to 'StoneGate')")
      .addText((text) =>
        text
          .setPlaceholder("StoneGate")
          .setValue(this.plugin.settings.customTitle || "")
          .onChange((value) => {
            this.plugin.settings.customTitle = value.trim() || undefined;
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Custom Background URL/Path")
      .setDesc("URL or local path to a custom background image. You can use an external URL (http/https), or a local file from the vault (simply type the file name or use the path in the vault).")
      .addText((text) => {
        text
          .setPlaceholder("https://example.com/image.jpg")
          .setValue(this.plugin.settings.customBackgroundUrl || "")
          .onChange((value) => {
            this.plugin.settings.customBackgroundUrl = value.trim();
            void this.plugin.saveSettings();
          });
        new ImagePathSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Background Blur Amount")
      .setDesc("How blurred the custom background image appears on the lock screen (min 2px, max 10px).")
      .addSlider((slider) =>
        slider
          .setLimits(2, 10, 1)
          .setValue(this.plugin.settings.customBackgroundBlurPx ?? 10)
          .setDynamicTooltip()
          .onChange((value) => {
            this.plugin.settings.customBackgroundBlurPx = value;
            void this.plugin.saveSettings();
          })
      );
  }
}
