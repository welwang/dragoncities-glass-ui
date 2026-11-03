# DragonCities Glass UI

[繁體中文](README.md) | **English**

**A glass-style interface and configurable branding for Pterodactyl Panel v1.15.2.**

Author: **小黑柴 (dc_id: 小黑柴)**.

## Features

- Light and dark glass themes with preferences saved per browser.
- A unified navigation shell with branding and actions above the server tabs, including a smooth transition between one and two rows.
- Moving tab lenses, glass server cards, menus, and dialogs.
- A global animation-speed slider from 0.25× to 1.5×, defaulting to 0.5×.
- Privacy blur for IP addresses and connection details: click to reveal, then automatically hide after 20 seconds.
- A console privacy-blur toggle and page transitions that keep content visible.
- Configurable panel name, PNG logo, site icons, and branding in notification email templates.
- Source compatibility checks, automatic frontend backups, and explicit restore commands.

## Requirements and scope

You need a working **Linux Pterodactyl Panel v1.15.2**, Node.js 22 or newer, Yarn Classic 1.x, the panel's PHP CLI, and at least 2 GiB of RAM plus swap.

This package supplies the interface and installation tools. It does not include the panel application, Wings, a database, or Minecraft servers. It does not run migrations, update Composer dependencies, upgrade the panel, edit `.env`, Wings or nginx configuration, or restart services.

The client area receives the full theme. `/admin` retains its existing AdminLTE layout; only its branding and animation-speed control are integrated.

## Installation

Read the **[complete installation, configuration, troubleshooting, and restore guide](docs/INSTALL.en.md)** first.

```bash
git clone https://github.com/welwang/dragoncities-glass-ui.git
cd dragoncities-glass-ui
git checkout v1.0.3
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh --check
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh
```

Keep this repository outside the panel directory, for example in your home directory. Versioned installation packages are available from [Releases](https://github.com/welwang/dragoncities-glass-ui/releases).

If another theme is installed, read the source compatibility section before proceeding. Do not drag files into the panel to overwrite them. The installer accepts recognized source versions and does not provide a forced-patching option.

## Install with an AI assistant

Use the **[copyable AI installation prompt, precautions, and minimum capabilities](docs/AI-INSTALL.en.md)**, also available in [繁體中文](docs/AI-INSTALL.md). Fill in your SSH connection details, panel directory, and branding; keep passwords and private-key contents out of chat.

The assistant needs terminal/SSH tools to install on your behalf; a chat-only model can provide instructions. The theme does not require an AI model running on the panel host. Node.js, Yarn, PHP, and build headroom are still required; AI-model specifications and panel-host requirements are separate.

## Custom name and logo

Set your branding during installation:

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='My Server Panel' \
BRAND_LOGO='/root/my-logo.png' \
bash install-dragoncities-ui.sh
```

Change it after installation:

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='My New Panel Name' \
BRAND_LOGO='/root/new-logo.png' \
bash configure-brand.sh
```

Names support 1–48 characters. Logos must be PNG images; a transparent square image is recommended. Omitted settings retain their current values. Changing branding after installation does not require a frontend rebuild: refresh your browser. See the asset terms below for the bundled logo's permitted uses.

## Resource usage

At runtime, the theme's additional server-side work is mainly serving static files and reading a small branding JSON file. It adds no persistent Node.js service. Installation builds create the larger server CPU and memory load; glass refraction and animations mainly consume the visitor's browser CPU, graphics resources, and memory.

Read the **[resource assessment and explanation](docs/RESOURCES.en.md)** for measured observations, file sizes, calculations, and the effects of display resolution, card count, scrolling, and slower animations. Installation requirements are not guarantees of fixed runtime usage.

## Restore

Installation prints `FRONTEND_BACKUP=` and a complete restore command. Use your actual backup path:

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh \
  --revert /root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

Keep the matching installation directory and backup. The installation guide explains the restore scope and failure handling.

## Repository layout

```text
install-dragoncities-ui.sh  Install, preflight, and restore entry point
configure-brand.sh         Branding configuration after installation
tools/configure-brand.cjs  Branding configuration and PNG checks
tools/build-release.py     Release ZIP and checksum generation
overlay/                  Integrated interface sources and default branding
vendor/                   Original base-theme patch, script, and documentation
docs/INSTALL.en.md         Complete English installation guide
docs/RESOURCES.en.md       Resource assessment
FILES.json                Target panel file list
*.sha256 / *-absent.txt    Source compatibility and integrity manifests
```

The original base patch and script are preserved. Use the integrated entry point for installation and restoration; do not separately run the scripts in `vendor/`.

## License, copyright, and trademarks

- New project code and documentation: **MIT License, Copyright (c) 2026 小黑柴 (dc_id: 小黑柴)**.
- Upstream Pterodactyl portions: the MIT copyright and permission notices of **Dane Everitt and contributors** are retained.
- Silver dragon logo: [separate brand-asset terms](ASSETS-LICENSE.en.md); it is excluded from the code's MIT license.
- Full source, dependency, and trademark notices: [NOTICE.en.md](NOTICE.en.md).

This is not an official Pterodactyl or Apple product. Names and trademarks belong to their respective owners. The MIT license does not transfer the original authors' copyright or grant trademark rights in third-party names, logos, or materials. The software is supplied as-is under its license, without a promise that it will work with every panel version or customized environment.

Do not post passwords, API tokens, `.env` files, complete backups, or private information in public issues. Include the panel version, installation steps, and error messages with sensitive information removed.
