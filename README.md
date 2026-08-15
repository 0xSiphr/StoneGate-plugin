<p align="center">
  <img src="assets/StoneGate-logo.png" width="550" alt="StoneGate Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/xsiphr/StoneGate-plugin?label=Release&color=483699&style=flat-square" alt="Release">
  <img src="https://img.shields.io/github/stars/xsiphr/StoneGate-plugin?style=flat-square&color=EBCB8B" alt="Stars">
  <img src="https://img.shields.io/badge/version-2.0.4-blueviolet?style=flat-square" alt="Version">
  <a href="https://obsidian.md/plugins?id=stonegate"><img src="https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[%22stonegate%22].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-desktop%20%7C%20mobile-informational?style=flat-square" alt="Platform">
</p>

StoneGate protects your Obsidian vault and individual folders with password authentication, idle timeouts, brute-force lockouts, and an optional stealth mode that hides protected folders entirely.

<p align="center">
  <img src="assets/hero-preview.png" width="700" alt="StoneGate lock screen">
</p>

## <img src="assets/bonefire.gif" width="40"> Installation

**From Community Plugins (recommended)**

1. Open Obsidian's **Settings → Community plugins**.
2. Make sure **Restricted mode** is turned off.
3. Click **Browse** and search for ["StoneGate"](https://community.obsidian.md/plugins/stonegate).
4. Click **Install**, then **Enable** the plugin.

<p align="center">
  <img src="assets/install-demo.gif" width="600" alt="Install and enable demo">
</p>

**Manual installation**

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/xsiphr/StoneGate-plugin/releases/latest).
2. Create a folder named `stonegate` inside your vault's `.obsidian/plugins/` directory.
3. Copy the three downloaded files into that folder.
4. Reload Obsidian and enable StoneGate from **Settings → Community plugins**.

<p align="center">
  <img src="https://img.shields.io/github/downloads/xsiphr/StoneGate-plugin/total?style=flat-square&color=A3BE8C&label=manual%20downloads" alt="Manual Downloads">
</p>

## <img src="assets/bonefire.gif" width="40"> Features

**Vault & Folder Protection**
Lock your entire vault or specific sensitive folders, each with its own password.

<p align="center">
  <img src="assets/feature-wrong-password.png" width="600" alt="Password protection">
</p>

**Idle Timeout**
Automatically re-lock a path after a configurable period of inactivity.

**Persistent Lockout**
Blocks further attempts for a cooldown period after repeated failed passwords.

<p align="center">
  <img src="assets/feature-lockout.png" width="600" alt="Lockout after failed attempts">
</p>

**Emergency Recovery**
Generate a one-time recovery code to regain access if you forget your password.

<p align="center">
  <img src="assets/feature-recovery-key-gen.png" width="600" alt="Generate recovery key">
  <img src="assets/feature-recovery-code.png" width="600" alt="Recovery code entry">
</p>

**Ghost Mode**
Hide protected folders from the File Explorer entirely until unlocked.

<p align="center">
  <img src="assets/feature-ghost-mode-demo.gif" width="600" alt="Ghost mode demo">
</p>

**Custom Backgrounds**
Set a custom lock screen background from a URL or a file in your vault.

<p align="center">
  <img src="assets/feature-background-demo.gif" width="600" alt="Custom background demo">
</p>

## <img src="assets/bonefire.gif" width="40"> Configuration

- **Master Password** — set in the plugin's settings tab to enable base vault protection.
- **Per-folder passwords** — add a protected path and give it its own password, independent of the master password.
- **Recovery Code** — generate under "Recovery Options." Keep this code offline; it's the only way back in if you forget your password.
- **Ghost Mode** — when enabled on a path, that folder disappears from the File Explorer while locked. Reach it via the Command Palette (`StoneGate: Unlock hidden/locked path`).

<p align="center">
  <img src="assets/config-settings-1.png" width="600" alt="Settings tab 1">
  <img src="assets/config-settings-2.png" width="600" alt="Settings tab 2">
</p>
<p align="center">
  <img src="assets/config-protect-path.png" width="600" alt="Protect new path with Ghost Mode">
</p>

## <img src="assets/bonefire.gif" width="40"> Hotkeys

Configure these under **Settings → Hotkeys**:

- **Lock vault now** — manually trigger the lock screen.
- **Lock current folder** — lock just the folder containing the active file.
- **Unlock hidden/locked path** — open the menu to find and unlock a protected or hidden path.

<p align="center">
  <img src="assets/hotkeys.png" width="600" alt="Hotkeys settings">
  <img src="assets/hotkeys-command-palette.png" width="600" alt="Command palette unlock">
</p>

## <img src="assets/bonefire.gif" width="40"> Security Practices

- **Hashing** — passwords and recovery codes are hashed with PBKDF2 (SHA-256, 200,000 iterations) via the Web Crypto API, each with a unique random salt.
- **Local only** — all secrets stay on your device. Nothing is transmitted to an external server.
- **Defense in depth** — for sensitive vaults, pair StoneGate with system-level encryption (e.g. Cryptomator) rather than relying on it alone.

## <img src="assets/bonefire.gif" width="40"> License

MIT — see [LICENSE](LICENSE).

Built by [Abdulrahman Agiba | xsiphr](https://github.com/xsiphr).
