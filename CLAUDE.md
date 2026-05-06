# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Electron in development mode (hot reload)
npm run build      # Compile TypeScript + Vite bundle into out/
npm run preview    # Preview the production build
npm run typecheck  # Type-check main and renderer processes separately
npm run lint       # ESLint all .ts/.tsx files
npm run rebuild    # Recompile native modules (better-sqlite3) against Electron
```

> **Native modules (better-sqlite3):** `.npmrc` sets `runtime=electron` so `npm install` fetches Electron-specific prebuilts automatically. If you upgrade Electron, update the `target` in `.npmrc` and run `npm run rebuild`.

## Architecture

This is an **Electron + React + TypeScript** desktop app. The codebase is split between two Electron processes that must stay separate.

### Process Separation

| Process | Path | Responsibilities |
|---|---|---|
| Main (Node.js) | `src/main/` | File I/O, SQLite, Notion API, IPC handlers, cron scheduler |
| Preload | `src/preload/index.ts` | Bridges the two processes; exposes `window.api` to the renderer via `contextBridge` |
| Renderer (React) | `src/renderer/src/` | UI only. Never touches the FS or DB directly. All data flows through `window.api` |

The renderer **must never** import from `src/main/` or use Node APIs directly. Everything goes via IPC.

### Key Directories

```
src/
├── main/
│   ├── index.ts              # Main process entry: creates window, starts DB + scheduler
│   ├── db/
│   │   ├── index.ts          # DB singleton (getDb / initDatabase)
│   │   ├── migrations.ts     # Versioned SQL schema migrations
│   │   └── settings.ts       # Typed key-value settings store
│   ├── backup/
│   │   ├── BackupManager.ts  # Orchestrates the backup: calls provider → writes via storage
│   │   ├── providers/
│   │   │   ├── ISourceProvider.ts   # Interface: fetchRootPages / fetchPageTree
│   │   │   └── NotionProvider.ts    # Notion API implementation (blocks → Markdown)
│   │   └── storage/
│   │       ├── IStorage.ts          # Interface: writeFile / ensureDir
│   │       └── FileStorage.ts       # Local-disk implementation
│   ├── ipc/index.ts          # All ipcMain.handle() registrations
│   └── scheduler/Scheduler.ts # node-cron wrapper; call reschedule() after settings change
├── preload/index.ts           # window.api type + contextBridge exposure
└── renderer/src/
    ├── main.tsx               # React entry (HashRouter)
    ├── App.tsx                # Layout + routes
    ├── pages/
    │   ├── Dashboard.tsx      # Manual backup trigger + history table
    │   └── Settings.tsx       # Token, root path, cron schedule
    └── styles/global.css
```

### Adding a New Storage Backend (e.g. Google Drive)

1. Create `src/main/backup/storage/GDriveStorage.ts` implementing `IStorage`.
2. Add a storage type discriminator to settings.
3. Instantiate the correct storage class in `src/main/ipc/index.ts` based on the setting.
`BackupManager` is storage-agnostic and requires no changes.

### Adding a New Source Provider (e.g. Confluence)

1. Create `src/main/backup/providers/ConfluenceProvider.ts` implementing `ISourceProvider`.
2. Expose configuration in Settings and instantiate in IPC/Scheduler.

### Page Hierarchy → File System Mapping

`BackupManager.processNode()` recurses the `PageNode` tree:
- Each page becomes a **directory** named after its (sanitized) title.
- If the page has content, a `root.md` is written inside that directory.
- Child pages are processed recursively under that directory.

### IPC Contract

All renderer↔main communication is defined in `src/preload/index.ts` as the `Api` type. The renderer imports only the `Api` type (not any main-process code) via `src/renderer/src/env.d.ts` → `window.api`.

Channels:
- `settings:get` / `settings:set`
- `dialog:selectDirectory`
- `backup:run` (returns `{ count }`, emits `backup:progress` events during run)
- `backup:history`

### Database

SQLite file lives at `app.getPath('userData')/notion-backup.db`. Schema is in `src/main/db/migrations.ts`. Add new migrations as array entries — the version is auto-tracked in the `schema_version` table.

Tables: `settings`, `sync_jobs`, `sync_job_pages`.
