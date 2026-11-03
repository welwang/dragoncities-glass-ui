# Installation, branding, and restoration

[繁體中文](INSTALL.md) | **English**

This guide covers DragonCities Glass UI **1.0.2** for **Pterodactyl Panel v1.15.2**.

## Installation scope

Start with a working Pterodactyl panel that can already authenticate users, connect to nodes, and manage servers. This tool installs the frontend interface and branding; it does not set up the panel, Wings, a database, or game servers.

The integrated installer checks source compatibility, backs up affected interface files and existing compiled assets, applies the original base theme, adds the integrated components and branding, then builds the frontend, runs TypeScript checks, and clears the view cache.

It does not change `.env`, the database, Wings, or nginx; run migrations or Composer updates; upgrade the panel; or restart services. Frontend assets are regenerated during the build. Install during a quiet period and do not install other extensions at the same time.

## Requirements

| Item | Requirement |
| --- | --- |
| Operating system | Linux with Bash and standard GNU system tools |
| Panel | A working Pterodactyl Panel v1.15.2 |
| Node.js | 22 or newer |
| Yarn | Classic 1.x; 1.22.22 is recommended |
| PHP | The panel's PHP CLI; the installation account must be able to run `php artisan view:clear` |
| System tools | git, tar, sha256sum, free, awk, cut, realpath, mktemp, cp; unzip for ZIP releases |
| Memory | At least 2 GiB of RAM plus swap; 4 GiB or more is recommended, with enough memory actually available |
| Disk | Space for a complete frontend backup, dependencies, and new compiled assets |
| Permissions | Write access to the panel and backup directory; PHP must be able to read the installed sources and public assets |

The default panel path is `/var/www/pterodactyl`. If yours differs, use the correct `PANEL_DIR` in every command.

Build-time, server runtime, and browser rendering costs differ. Read the [resource assessment](RESOURCES.en.md). The 2 GiB gate is not a guarantee of sufficient capacity; based on the local build reference, plan roughly 3–4 GiB of available memory headroom beyond existing OS and game workloads.

Check the tools first:

```bash
node -v
yarn -v
php -v
git --version
free -h
```

Install Node.js using its [official download and installation instructions](https://nodejs.org/en/download). If Node.js and npm are available but Yarn Classic is missing, install it with the permissions appropriate for your environment:

```bash
npm install --global yarn@1.22.22
```

If using nvm, select the correct Node.js version first. This tool does not automatically install or upgrade system runtimes. It stops if RAM plus swap is below the threshold; adjust host resources before proceeding.

## Accepted source states

The installer accepts two source states:

1. A clean official v1.15.2 frontend: existing files are checked by SHA256, new files must be absent, and the base patch must pass `git apply --check --whitespace=error`.
2. The recognized previous DragonCities UI integration: Liquid Glass v9, the silver logo, two-row bar, global animation speed, and page-transition fix, with all expected file hashes matching.

For the second state, the installer adds the integrated files without applying the base patch again. If the same fixed source version is already installed, it reports that state; use the branding tool to change a name or logo.

Other old themes, third-party themes, and manually edited files are not guaranteed to upgrade directly. Unrecognized sources cause the installer to stop and report differences. Restore with the previous theme's uninstaller or pre-installation backup. Do not bypass compatibility checks with force, `--reject`, `--3way`, or patch edits.

The official v1.15.2 tag may show `canary` in `config/app.php`, so compatibility is checked against the corresponding frontend file fingerprints. This does not imply support for other canary builds or panel versions.

## Download option 1: Git

Download into your home directory or another location outside the panel:

```bash
cd ~
git clone https://github.com/welwang/dragoncities-glass-ui.git
cd dragoncities-glass-ui
git checkout v1.0.2
sha256sum -c SHA256SUMS
```

A fixed tag avoids later unreleased changes. Read the source and this guide before running the installer.

## Download option 2: Release ZIP

Download `DragonCities-Glass-UI-v1.0.2.zip` and its `.sha256` from [GitHub Releases](https://github.com/welwang/dragoncities-glass-ui/releases), then upload both to your host. These examples use port 23; replace the account, host address, port, and local paths as needed:

```powershell
scp -P 23 .\DragonCities-Glass-UI-v1.0.2.zip user@HOST_IP:~/
scp -P 23 .\DragonCities-Glass-UI-v1.0.2.zip.sha256 user@HOST_IP:~/
ssh -p 23 user@HOST_IP
```

On Linux, verify and extract:

```bash
cd ~
sha256sum -c DragonCities-Glass-UI-v1.0.2.zip.sha256
mkdir -p ~/dragoncities-ui-release
unzip DragonCities-Glass-UI-v1.0.2.zip -d ~/dragoncities-ui-release
cd ~/dragoncities-ui-release/dragoncities-glass-ui-1.0.2
sha256sum -c SHA256SUMS
```

The ZIP checksum verifies download consistency; the internal manifest checks the extracted files. Neither is an author signature or a substitute for checking the download source.

## Preflight

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh --check
```

`--check` verifies the environment, package versions, memory, package integrity, and source compatibility without changing panel files. Continue after `Preflight passed`. If the same UI is already installed, use the branding tool instead.

If the old standalone module still exists at `public/themes/liquid-glass/`, remove it using its original removal procedure and restore a consistent source state first. The installer does not delete unknown theme files automatically.

## Install

Use the default name and bundled logo:

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh
```

Or set your own branding during the first installation:

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='My Server Panel' \
BRAND_LOGO='/root/my-logo.png' \
bash install-dragoncities-ui.sh
```

| Setting | Meaning |
| --- | --- |
| `PANEL_DIR` | Panel directory; defaults to `/var/www/pterodactyl` |
| `BRAND_NAME` | 1–48 characters, without control characters; short names work best on mobile |
| `BRAND_LOGO` | Absolute path to a PNG on the host; a transparent square image of at least 256×256 is recommended |
| `BACKUP_DIR` | Optional existing, writable backup directory; defaults to the installation account's home directory |

`BRAND_LOGO` is not an image URL or a Windows path to an image that has not been uploaded. Ensure you have permission to use and publicly serve your image.

Installation order:

1. Verify package integrity and source compatibility.
2. Back up the frontend and record which target files are newly added.
3. Apply the original base patch with standard git apply when needed, without modifying the patch.
4. Copy the integration files and verify the final fixed sources.
5. Write branding configuration and versioned image URLs.
6. Run `yarn install --frozen-lockfile --ignore-engines`.
7. Run `yarn build:production` and `yarn tsc`.
8. Run `php artisan view:clear` and print the restore command.

`--frozen-lockfile` keeps the existing locked dependency versions. The installer checks Node.js before using `--ignore-engines`; this flag is not permission to use an unsupported runtime.

After success, press Ctrl+F5 or close and reopen the panel tab. Existing tabs may still hold asset URLs from the previous version.

## Backup contents and location

The installer prints a path such as:

```text
FRONTEND_BACKUP=/root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

The backup contains pre-existing target frontend files, affected templates and branding files, `public/assets`, `yarn.lock`, and a record of files newly added by this installation. Keep it somewhere safe.

This is a frontend restore backup. It does not include the database, `.env`, game data, or `node_modules`. Continue managing application and game backups through your normal operational procedures. The installer does not delete older backups.

## Change the name and logo after installation

Return to the same installation package directory. Change only the name:

```bash
PANEL_DIR=/var/www/pterodactyl BRAND_NAME='My New Panel Name' bash configure-brand.sh
```

Change only the logo:

```bash
PANEL_DIR=/var/www/pterodactyl BRAND_LOGO='/root/new-logo.png' bash configure-brand.sh
```

Change both:

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='My New Panel Name' BRAND_LOGO='/root/new-logo.png' \
bash configure-brand.sh
```

Omitted settings retain their current values. Configuration is stored in `public/branding/brand.json`, with the PNG at `public/branding/panel-logo.png`. The tool also updates the manifest, icon configuration, and versioned image URL.

Navigation, login pages, page titles, admin branding, site icons, and notification email templates share these settings. No frontend rebuild or service restart is needed. Refresh the browser; site icons may require reopening the tab.

The panel brand is distinct from server names. It does not change `.env`'s APP_NAME, sender addresses, or Pterodactyl copyright text. Prefer the configuration tool over manual JSON edits.

Before each change, `public/branding` is backed up to `ptero-brand-backup-DATE.tar.gz`. To undo a branding change, use your actual backup path:

```bash
tar -xzf /root/ptero-brand-backup-YYYYMMDD-HHMMSS.tar.gz -C /var/www/pterodactyl
```

## Full restore

Use the actual backup created by the integrated installer:

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh \
  --revert /root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

The tool restores original files and compiled assets, removes target files newly added by this installation, and clears the view cache. Because compiled assets are included, restoration does not reinstall dependencies, rebuild the frontend, or restart services.

If the recognized previous DragonCities UI was installed beforehand, restoration returns to that version. A clean-panel installation restores the clean frontend. Do not overwrite an upgraded panel or later extensions with an old frontend backup.

`--revert` only accepts backups created by this tool, named `*-dragoncities.tar.gz` and containing the new-file record. It does not support arbitrary archives from other theme installers.

## Handling failures

The tool stops at errors and retains the original messages. If the backup has already been created, it prints a restore command. Save the error, confirm the backup, then address the cause or restore. Do not modify the original patch or bypass source checks just to make installation proceed.

| Symptom | Action |
| --- | --- |
| `Package integrity check failed` | Download the same tag or Release again and check for manually edited package files |
| `Unrecognized frontend modifications` | Restore through the previous theme or backup; retain the reported differences |
| `Missing command`, missing Node or Yarn | Check the installation account's PATH; load nvm and select the correct version when applicable |
| Wrong Node or Yarn version | Use Node.js 22+ and Yarn Classic 1.x, not Yarn Berry |
| Out of memory or build killed | Check available memory and host resources; do not repeatedly install over a failed source state |
| `BRAND_LOGO must be a valid PNG` | Confirm the uploaded file is genuinely PNG, not another format renamed to .png |
| `php: command not found` | Use the panel's PHP CLI; restore the correct PATH, then use the printed restore command or complete cache clearing |
| Permission errors | Use an account with panel write access and ensure PHP can read the files; do not chmod the entire panel to 777 |
| Old interface after updating | Ctrl+F5 or reopen the tab; old assets and icons may remain cached |

The shell installer targets Linux. Use Windows to download, upload, and read the sources, not to run the Linux installer directly in PowerShell.

## Modifying sources and building releases

Keep the original `vendor/` files and upstream notices intact. Place integration changes in `overlay/`. After changing interface code, rebuild in a matching panel development copy and update manifests such as `final-source.sha256`. Branding-only changes should use the configuration tool.

Maintainers can run this in a clean, reviewed Git working directory:

```bash
python3 tools/build-release.py
```

Python 3.10+ and Git are required. The command uses tracked files to generate `SHA256SUMS`, `dist/DragonCities-Glass-UI-v1.0.2.zip`, and the ZIP checksum. It does not operate on the panel or connect to a host.

## License and attribution

Copyright (c) 2026 小黑柴 (dc_id: 小黑柴). New code and documentation are MIT licensed. Retain upstream Pterodactyl MIT notices; the silver dragon logo has separate asset terms. See [LICENSE](../LICENSE), [NOTICE.en.md](../NOTICE.en.md), and [ASSETS-LICENSE.en.md](../ASSETS-LICENSE.en.md).
