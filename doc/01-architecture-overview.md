# Architecture Overview

## Introduction

Notion Backup MD is an **Electron + React + TypeScript** desktop application that backs up Notion pages as local Markdown files. The application features scheduled backup automation, a clean UI dashboard, and a plugin-like architecture for extensibility.

## High-Level Architecture

The application follows Electron's multi-process architecture with strict separation between the main process (Node.js backend) and renderer process (React frontend).

```mermaid
graph TB
    subgraph "Renderer Process (React)"
        UI[User Interface]
        Dashboard[Dashboard Page]
        Settings[Settings Page]
        Router[React Router]
    end

    subgraph "Preload Bridge"
        API[window.api]
        Bridge[contextBridge]
    end

    subgraph "Main Process (Node.js)"
        IPC[IPC Handlers]
        BM[BackupManager]
        Scheduler[Cron Scheduler]
        DB[(SQLite Database)]

        subgraph "Providers"
            NP[NotionProvider]
            IP[ISourceProvider Interface]
        end

        subgraph "Storage"
            FS[FileStorage]
            IS[IStorage Interface]
        end
    end

    subgraph "External Services"
        Notion[Notion API]
        LocalFS[Local File System]
    end

    UI --> Router
    Router --> Dashboard
    Router --> Settings
    Dashboard --> API
    Settings --> API

    API --> Bridge
    Bridge --> IPC

    IPC --> BM
    IPC --> Scheduler
    IPC --> DB

    BM --> NP
    BM --> FS

    NP -.implements.-> IP
    FS -.implements.-> IS

    Scheduler --> BM

    NP --> Notion
    FS --> LocalFS
    BM --> DB

    style UI fill:#e1f5ff
    style Dashboard fill:#e1f5ff
    style Settings fill:#e1f5ff
    style Router fill:#e1f5ff
    style API fill:#fff4e6
    style Bridge fill:#fff4e6
    style IPC fill:#e8f5e9
    style BM fill:#e8f5e9
    style Scheduler fill:#e8f5e9
    style DB fill:#f3e5f5
    style NP fill:#e8f5e9
    style FS fill:#e8f5e9
```

## Process Separation

Electron applications run in two distinct processes for security and stability:

| Process | Path | Responsibilities | Restrictions |
|---------|------|------------------|--------------|
| **Main Process** | `src/main/` | File I/O, SQLite, Notion API, IPC handlers, cron scheduler | Full Node.js access |
| **Preload** | `src/preload/index.ts` | Bridges main and renderer processes via `contextBridge` | Limited, secure API exposure |
| **Renderer Process** | `src/renderer/src/` | UI only (React components) | **NO** direct Node.js, filesystem, or database access |

### Security Model

```mermaid
sequenceDiagram
    participant Renderer as Renderer Process<br/>(Untrusted)
    participant Preload as Preload Script<br/>(Bridge)
    participant Main as Main Process<br/>(Trusted)
    participant FS as File System

    Note over Renderer: User clicks "Run Backup"
    Renderer->>Preload: window.api.backup.run()
    Preload->>Main: IPC: backup:run
    Main->>Main: Validate request
    Main->>FS: Read/Write files
    Main-->>Preload: IPC: backup:progress events
    Preload-->>Renderer: Progress updates
    Main-->>Preload: Return result
    Preload-->>Renderer: { count: 42 }

    Note over Renderer,FS: Renderer can NEVER directly access filesystem
```

**Key Principle**: The renderer process operates in a sandboxed environment and can only perform operations explicitly exposed through the IPC contract defined in the preload script.

## Core Components

### 1. BackupManager

**Location**: `src/main/backup/BackupManager.ts`

**Purpose**: Orchestrates the backup process by coordinating content providers and storage backends.

**Responsibilities**:
- Create and track backup jobs in the database
- Recursively process page hierarchies
- Sanitize filenames for filesystem compatibility
- Emit progress events to the UI
- Handle errors gracefully

### 2. Source Providers (Strategy Pattern)

**Interface**: `ISourceProvider` (`src/main/backup/providers/ISourceProvider.ts`)

**Current Implementation**: `NotionProvider`

**Responsibilities**:
- Fetch content from external sources
- Convert content to Markdown format
- Build page hierarchies with parent-child relationships

**Extensibility**: New providers (Confluence, Google Workspace, etc.) can be added by implementing the `ISourceProvider` interface.

### 3. Storage Backends (Strategy Pattern)

**Interface**: `IStorage` (`src/main/backup/storage/IStorage.ts`)

**Current Implementation**: `FileStorage`

**Responsibilities**:
- Write Markdown files to destination
- Create directory structures
- Handle path sanitization

**Extensibility**: New storage backends (Google Drive, S3, Dropbox, etc.) can be added by implementing the `IStorage` interface.

### 4. Scheduler

**Location**: `src/main/scheduler/Scheduler.ts`

**Purpose**: Manages automated backups using cron expressions.

**Features**:
- Start scheduled tasks on application launch
- Dynamically reschedule when settings change
- Validate cron expressions before scheduling
- Execute silent background backups

### 5. Database Layer

**Location**: `src/main/db/`

**Components**:
- `index.ts`: SQLite connection singleton with WAL mode
- `migrations.ts`: Versioned schema migrations
- `settings.ts`: Type-safe key-value configuration store

## Data Flow

### Manual Backup Flow

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant IPC
    participant BM as BackupManager
    participant NP as NotionProvider
    participant FS as FileStorage
    participant DB as Database

    User->>Dashboard: Click "Run Backup"
    Dashboard->>IPC: backup:run
    IPC->>DB: Create sync_job (status='running')
    IPC->>BM: run(onProgress)

    BM->>NP: fetchRootPages()
    NP->>NP: Query Notion API
    NP-->>BM: [PageNode, PageNode, ...]

    loop For each page tree
        BM->>NP: fetchPageTree(pageId)
        NP-->>BM: PageNode with children
        BM->>BM: processNode(node)
        BM->>FS: ensureDir(path)
        BM->>FS: writeFile(path, markdown)
        BM->>DB: INSERT sync_job_pages
        BM-->>IPC: onProgress event
        IPC-->>Dashboard: Real-time update
    end

    BM->>DB: UPDATE sync_job (status='success')
    BM-->>IPC: Return { count }
    IPC-->>Dashboard: Backup complete
    Dashboard->>IPC: backup:history
    IPC-->>Dashboard: Refresh history table
```

### Scheduled Backup Flow

```mermaid
sequenceDiagram
    participant Cron as node-cron
    participant Scheduler
    participant BM as BackupManager
    participant DB as Database

    Note over Cron: At scheduled time<br/>(e.g., 2:00 AM daily)
    Cron->>Scheduler: Execute task
    Scheduler->>Scheduler: Read settings
    alt Schedule enabled
        Scheduler->>BM: run()
        BM->>DB: Create sync_job
        BM->>BM: Execute backup
        BM->>DB: Update sync_job
        Note over Scheduler,DB: Silent execution<br/>(no UI updates)
    else Schedule disabled
        Scheduler->>Scheduler: Skip execution
    end
```

## Directory Structure & Page Hierarchy Mapping

Notion's hierarchical page structure is mapped to a local filesystem directory structure:

**Notion Workspace**:
```
Root Page
├── Child Page A
│   └── Grandchild Page
└── Child Page B
```

**Local Filesystem**:
```
/backup-root/
├── Root Page/
│   ├── root.md           ← Content of "Root Page"
│   ├── Child Page A/
│   │   ├── root.md       ← Content of "Child Page A"
│   │   └── Grandchild Page/
│   │       └── root.md   ← Content of "Grandchild Page"
│   └── Child Page B/
│       └── root.md       ← Content of "Child Page B"
```

**Naming Rules**:
- Directory names match page titles (sanitized)
- Page content stored as `root.md` within its directory
- Invalid filesystem characters removed: `/\:*?"<>|`
- Length limited to 200 characters
- Multiple spaces collapsed to single space

## IPC Contract

All communication between renderer and main processes flows through well-defined IPC channels:

| Channel | Direction | Parameters | Returns | Purpose |
|---------|-----------|------------|---------|---------|
| `settings:get` | Renderer → Main | - | `Settings` object | Fetch all configuration |
| `settings:set` | Renderer → Main | `key`, `value` | `void` | Save single setting |
| `dialog:selectDirectory` | Renderer → Main | - | `string \| null` | Open folder picker |
| `backup:run` | Renderer → Main | - | `{ count: number }` | Trigger manual backup |
| `backup:progress` | Main → Renderer | `BackupProgress` | - | Stream progress events |
| `backup:history` | Renderer → Main | - | `SyncJob[]` | Fetch last 50 jobs |

**Type Safety**: All IPC channels are strongly typed in `src/preload/index.ts` and exposed to the renderer via `window.api`.

## Extensibility Architecture

The application uses the **Strategy Pattern** with **Dependency Injection** to enable plugin-like extensibility:

### Adding a New Storage Backend (e.g., Google Drive)

```mermaid
graph LR
    A[Create GDriveStorage.ts] --> B[Implement IStorage interface]
    B --> C[Add storage type to Settings]
    C --> D[Instantiate in IPC handlers]
    D --> E[No BackupManager changes needed!]

    style E fill:#c8e6c9
```

### Adding a New Content Source (e.g., Confluence)

```mermaid
graph LR
    A[Create ConfluenceProvider.ts] --> B[Implement ISourceProvider interface]
    B --> C[Add source type to Settings]
    C --> D[Instantiate in IPC/Scheduler]
    D --> E[No BackupManager changes needed!]

    style E fill:#c8e6c9
```

**Key Design Principle**: `BackupManager` depends on abstractions (`ISourceProvider`, `IStorage`), not concrete implementations. This enables adding new providers and storage backends without modifying core backup logic.

## Error Handling

### Backup Failures

- Individual page failures recorded in `sync_job_pages` table
- Overall job status set to `'failed'` if any page fails
- Error messages stored for debugging
- UI displays failed jobs with error details

### Settings Validation

- Cron expressions validated before scheduling
- Invalid expressions silently ignored (no task created)
- File path validation via native dialog
- Notion token validation on first backup attempt

### Process Isolation Benefits

- Renderer crashes don't affect main process
- Main process continues scheduled backups even if UI closed
- Database transactions ensure consistency on crashes

## Build & Distribution

The application is compiled and packaged using:

- **Vite** for fast development with hot module replacement
- **electron-vite** for optimized Electron builds
- **electron-builder** for cross-platform distribution

Supported platforms:
- Windows (NSIS installer)
- macOS (DMG)
- Linux (AppImage, deb)

## Summary

Notion Backup MD follows a robust, secure architecture that:

1. **Separates concerns** between UI (renderer) and backend logic (main)
2. **Enforces security** through process isolation and controlled IPC
3. **Enables extensibility** via strategy pattern interfaces
4. **Maintains data integrity** with SQLite transactions and error tracking
5. **Provides real-time feedback** through event-driven progress updates
6. **Supports automation** via flexible cron scheduling
