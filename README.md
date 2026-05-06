# Notion Backup MD

Notion Backup MD is a powerful desktop application built with Electron, React, and TypeScript designed to automate the process of backing up your Notion workspace into clean, organized Markdown files.

![Notion Backup MD Banner](https://via.placeholder.com/800x400.png?text=Notion+Backup+MD)

## ✨ Features

- **Automated Backups**: Schedule recurring backups using flexible CRON expressions.
- **Clean Markdown**: Converts Notion blocks into standard Markdown files.
- **Hierarchical Structure**: Mirrors your Notion page structure on your local file system.
- **Sync History**: Track previous backup jobs, their status, and any errors.
- **Progress Tracking**: Real-time progress updates during backup operations.
- **Native Experience**: A sleek, responsive desktop application built with Electron.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS version recommended)
- [NPM](https://www.npmjs.com/) (usually comes with Node.js)
- A **Notion API Token**:
  1. Go to [Notion Integrations](https://www.notion.so/my-integrations).
  2. Create a new integration (Internal Integration).
  3. Copy your "Internal Integration Secret".
  4. Ensure the integration has access to the pages you want to backup (use the "Add connection" feature in Notion).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/notion-backup-md.git
   cd notion-backup-md
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development

To start the application in development mode with hot-reloading:

```bash
npm run dev
```

If you encounter issues with native modules (specifically `better-sqlite3`), you can force a rebuild:

```bash
npm run rebuild
```

## 🛠️ Usage

1. **Setup**: Upon launching, navigate to the **Settings** page.
2. **API Token**: Paste your Notion Integration Secret into the token field.
3. **Backup Path**: Select a local directory where you want your backups to be stored.
4. **Schedule**: Optionally, set a CRON expression (e.g., `0 0 * * *` for midnight every day) to automate your backups.
5. **Run**: Go to the **Dashboard** and click "Run Backup Now" to start your first sync.

## 🏗️ Architecture

The project follows a standard Electron structure with a strict separation of concerns:

- **Main Process** (`src/main/`): Handles Node.js specific logic including file system access, SQLite database management, Notion API requests, and the CRON scheduler.
- **Preload Script** (`src/preload/`): Bridges the Main and Renderer processes using a secure `contextBridge`.
- **Renderer Process** (`src/renderer/`): A modern React application for the user interface.

## 📦 Build & Distribution

To create a production-ready application, you first compile the code and then package it for your specific platform.

### 1. Compile the code
```bash
npm run build
```

### 2. Create an Installer
Generate a distributable package (e.g., `.deb`, `.AppImage`, `.exe`, or `.dmg`) by running the command for your platform:

- **Linux**: `npm run dist:linux`
- **Windows**: `npm run dist:win`
- **macOS**: `npm run dist:mac`

The generated installers will be available in the `release/` directory.

### Local Production Preview
If you want to test the production build locally without creating a full installer:
```bash
npm run preview
```

The output will be generated in the `out/` directory.

## 🔧 Troubleshooting

### Linux: SUID Sandbox Error
If you see an error like `The SUID sandbox helper binary was found, but is not configured correctly`, it's because Electron requires specific permissions for its sandbox on Linux.

**Fix 1: Set permissions (Recommended)**
```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

**Fix 2: Disable sandbox for development**
```bash
ELECTRON_DISABLE_SANDBOX=1 npm run dev
```

### Linux: Installed App (.deb) fails to launch
If the installed app doesn't open or shows a `zygote_host_impl_linux.cc` error in the terminal:

1. **Launch with no-sandbox**:
   ```bash
   notion-backup-md --no-sandbox
   ```
2. **Path issues**: Ensure the `executableName` in `package.json` does not contain spaces.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
