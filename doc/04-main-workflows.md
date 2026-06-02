# Main Workflows

## Overview

This document describes the primary workflows in Notion Backup MD, from user interactions to scheduled automation. Each workflow is illustrated with sequence diagrams showing the interactions between components.

---

## 1. Application Startup

### Purpose
Initialize the application, database, and scheduler when the user launches the app.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Main as Main Process
    participant DB as Database
    participant Scheduler
    participant Window as Renderer Window

    User->>Main: Launch application
    Main->>Main: app.whenReady()

    rect rgb(200, 230, 255)
        Note over Main,DB: Database Initialization
        Main->>DB: initDatabase()
        DB->>DB: Open notion-backup.db
        DB->>DB: Enable WAL mode
        DB->>DB: Run migrations
        DB-->>Main: Database ready
    end

    rect rgb(220, 255, 220)
        Note over Main,Scheduler: Scheduler Initialization
        Main->>Scheduler: start()
        Scheduler->>DB: getSetting('scheduleEnabled')
        DB-->>Scheduler: true/false
        alt Schedule enabled
            Scheduler->>DB: getSetting('scheduleCron')
            DB-->>Scheduler: "0 2 * * *"
            Scheduler->>Scheduler: cron.schedule(expression)
            Scheduler-->>Main: Scheduled
        else Schedule disabled
            Scheduler-->>Main: Not scheduled
        end
    end

    rect rgb(255, 240, 200)
        Note over Main,Window: Window Creation
        Main->>Window: createWindow()
        Window->>Window: Load index.html
        Window->>Window: Initialize React app
        Window-->>Main: Window ready
    end

    Main-->>User: Application running
```

### Steps

1. **Electron App Ready**: `app.whenReady()` event fires
2. **Database Initialization**:
   - Open SQLite database file
   - Enable WAL (Write-Ahead Logging) mode
   - Apply any pending schema migrations
   - Create tables if first run
3. **IPC Handler Registration**: Register all IPC channels for renderer communication
4. **Scheduler Startup**:
   - Read `scheduleEnabled` and `scheduleCron` settings
   - If enabled, create cron task
5. **Window Creation**:
   - Create BrowserWindow with preload script
   - Load React application (index.html)
6. **Renderer Initialization**:
   - Load settings from main process
   - Fetch backup history
   - Display dashboard

### Error Handling

| Error | Behavior |
|-------|----------|
| Database file corrupted | Log error, create new database |
| Invalid cron expression | Skip scheduling, continue startup |
| Window creation fails | Retry once, then exit app |

---

## 2. Manual Backup Workflow

### Purpose
User manually triggers a backup from the Dashboard page.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant IPC
    participant BM as BackupManager
    participant NP as NotionProvider
    participant Notion as Notion API
    participant FS as FileStorage
    participant DB as Database

    User->>Dashboard: Click "Run Backup Now"
    Dashboard->>Dashboard: setState({ runState: 'running' })

    Dashboard->>IPC: backup:run

    rect rgb(240, 255, 240)
        Note over IPC,DB: Job Initialization
        IPC->>DB: INSERT INTO sync_jobs<br/>(status='running')
        DB-->>IPC: job_id = 42
    end

    IPC->>BM: run(onProgress callback)

    rect rgb(255, 245, 230)
        Note over BM,Notion: Fetch Root Pages
        BM->>NP: fetchRootPages()
        NP->>Notion: client.search({ filter: "page" })
        Notion-->>NP: [{page1}, {page2}, ...]
        NP->>NP: Build PageNode objects
        NP-->>BM: [PageNode, PageNode, ...]
    end

    rect rgb(230, 240, 255)
        Note over BM,FS: Process Each Page Tree
        loop For each root page
            BM->>BM: processNode(node)
            BM->>NP: fetchPageTree(page.id)

            NP->>Notion: client.pages.retrieve(page_id)
            Notion-->>NP: Page metadata

            NP->>Notion: client.blocks.children.list(page_id)
            Notion-->>NP: [blocks...]

            NP->>NP: Convert blocks to Markdown
            NP->>NP: Recursively fetch child pages
            NP-->>BM: PageNode with children

            BM->>BM: sanitizeName(page.title)
            BM->>FS: ensureDir(sanitizedPath)
            FS->>FS: mkdir -p

            alt Page has content
                BM->>FS: writeFile("root.md", markdown)
                FS->>FS: Write to disk
            end

            BM->>DB: INSERT INTO sync_job_pages<br/>(status='ok')

            BM->>IPC: onProgress({ type: 'page', data })
            IPC-->>Dashboard: backup:progress event
            Dashboard->>Dashboard: Update progress log
        end
    end

    rect rgb(255, 240, 240)
        Note over BM,DB: Job Completion
        BM->>DB: UPDATE sync_jobs<br/>(status='success', finished_at)
    end

    BM-->>IPC: { count: 42 }
    IPC-->>Dashboard: Return result

    Dashboard->>Dashboard: setState({ runState: 'success' })
    Dashboard->>IPC: backup:history
    IPC->>DB: SELECT * FROM sync_jobs<br/>ORDER BY started_at DESC<br/>LIMIT 50
    DB-->>IPC: [jobs...]
    IPC-->>Dashboard: Update history table

    Dashboard-->>User: Show success message
```

### Steps

1. **User Initiates**:
   - Click "Run Backup Now" button
   - Button becomes disabled
   - Progress log appears

2. **Job Creation**:
   - Create `sync_jobs` record with `status='running'`
   - Store `started_at` timestamp

3. **Fetch Root Pages**:
   - Call Notion API's `search()` to find workspace-level pages
   - Convert to `PageNode` objects

4. **Process Each Page**:
   - **Fetch content**: Get page blocks from Notion API
   - **Convert to Markdown**: Transform Notion blocks to Markdown syntax
   - **Sanitize filename**: Remove invalid characters
   - **Create directory**: Make folder matching page hierarchy
   - **Write file**: Save `root.md` if page has content
   - **Record result**: Insert `sync_job_pages` entry
   - **Emit progress**: Send event to renderer for real-time updates
   - **Recurse children**: Process child pages in same directory

5. **Job Completion**:
   - Update `sync_jobs` with `status='success'` and `finished_at`
   - Return total page count

6. **UI Update**:
   - Display success message
   - Refresh history table
   - Re-enable backup button

### Progress Events

```typescript
// Sent to renderer during backup
type BackupProgress =
  | { type: 'start'; data: { message: string } }
  | { type: 'page'; data: { title: string; path: string } }
  | { type: 'error'; data: { message: string; pageTitle?: string } }
  | { type: 'complete'; data: { count: number } }
```

### Error Scenarios

```mermaid
graph TD
    A[Start Backup] --> B{Notion token valid?}
    B -->|No| C[Error: Invalid token]
    B -->|Yes| D{Notion API reachable?}
    D -->|No| E[Error: Network failure]
    D -->|Yes| F{Fetch pages}
    F --> G{Any page fetch fails?}
    G -->|Yes| H[Log error in sync_job_pages]
    H --> I{Continue with other pages}
    I --> J{All pages failed?}
    J -->|Yes| K[Job status = 'failed']
    J -->|No| L[Job status = 'success'<br/>with partial failures]
    G -->|No| L
    L --> M[Update job record]
    K --> M
    C --> N[Job not created]
    E --> O[Job status = 'failed']
    O --> M

    style C fill:#ffcdd2
    style E fill:#ffcdd2
    style K fill:#ffcdd2
    style N fill:#ffcdd2
    style O fill:#ffcdd2
    style L fill:#c8e6c9
    style M fill:#e1f5fe
```

---

## 3. Scheduled Backup Workflow

### Purpose
Automatically run backups at scheduled times based on cron expression.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Cron as node-cron
    participant Scheduler
    participant Settings as Settings DB
    participant BM as BackupManager
    participant DB as Database
    participant FS as File System

    Note over Cron: Scheduled time reached<br/>(e.g., 2:00 AM)

    Cron->>Scheduler: Execute task

    Scheduler->>Settings: getSetting('scheduleEnabled')
    Settings-->>Scheduler: true/false

    alt Schedule enabled
        Scheduler->>Settings: getSetting('notionToken')
        Settings-->>Scheduler: "secret_..."

        Scheduler->>Settings: getSetting('backupRootPath')
        Settings-->>Scheduler: "/path/to/backups"

        rect rgb(240, 255, 240)
            Note over Scheduler,DB: Silent Backup Execution
            Scheduler->>BM: run()
            BM->>DB: CREATE sync_job
            BM->>BM: Fetch & process pages
            BM->>FS: Write files
            BM->>DB: UPDATE sync_job
            BM-->>Scheduler: { count: 42 }
        end

        Scheduler->>Scheduler: Log success
    else Schedule disabled
        Scheduler->>Scheduler: Skip execution
    end

    Note over Cron,Scheduler: No UI updates<br/>(user may be asleep)
```

### Steps

1. **Cron Trigger**:
   - `node-cron` fires at scheduled time
   - Example: `"0 2 * * *"` = Every day at 2:00 AM

2. **Settings Check**:
   - Verify `scheduleEnabled` is still `true`
   - Load `notionToken` and `backupRootPath`

3. **Silent Backup**:
   - Execute same backup process as manual backup
   - **No progress events** sent to renderer (window may be closed)
   - All results recorded in database

4. **Logging**:
   - Log success/failure to console
   - Job record in database serves as audit trail

### Difference from Manual Backup

| Aspect | Manual Backup | Scheduled Backup |
|--------|---------------|------------------|
| **Trigger** | User click | Cron timer |
| **UI Updates** | Real-time progress events | None |
| **User Feedback** | Success toast + history refresh | Silent (check history later) |
| **Error Display** | Immediate error dialog | Recorded in database only |

### Schedule Management

```mermaid
stateDiagram-v2
    [*] --> Disabled: Default state
    Disabled --> Enabled: User toggles on
    Enabled --> Disabled: User toggles off

    state Enabled {
        [*] --> Scheduled: Valid cron expression
        Scheduled --> Rescheduled: User changes expression
        Rescheduled --> Scheduled
        Scheduled --> [*]: Toggle off
    }
```

---

## 4. Settings Management Workflow

### Purpose
User updates application configuration (Notion token, backup path, schedule).

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Settings as Settings Page
    participant IPC
    participant DB as Database
    participant Scheduler

    User->>Settings: Navigate to Settings page

    Settings->>IPC: settings:get
    IPC->>DB: getAllSettings()
    DB-->>IPC: { notionToken, backupRootPath, ... }
    IPC-->>Settings: Display current settings

    User->>Settings: Modify setting value

    Settings->>IPC: settings:set(key, value)

    IPC->>DB: UPDATE settings<br/>SET value = ?<br/>WHERE key = ?

    alt Setting is schedule-related
        IPC->>Scheduler: reschedule()
        Scheduler->>DB: getSetting('scheduleEnabled')
        Scheduler->>DB: getSetting('scheduleCron')

        alt Schedule enabled & valid cron
            Scheduler->>Scheduler: Stop old task
            Scheduler->>Scheduler: cron.schedule(newExpression)
            Scheduler-->>IPC: Rescheduled
        else Schedule disabled or invalid
            Scheduler->>Scheduler: Stop task
            Scheduler-->>IPC: Stopped
        end
    end

    IPC-->>Settings: Setting saved

    Settings->>Settings: Show "Settings saved" toast

    Settings-->>User: Visual confirmation
```

### Settings

| Setting | Type | Example | Triggers Reschedule? |
|---------|------|---------|---------------------|
| `notionToken` | string | `secret_AbC...XyZ` | No |
| `backupRootPath` | string | `/home/user/backups` | No |
| `scheduleEnabled` | boolean | `true` | **Yes** |
| `scheduleCron` | string | `0 2 * * *` | **Yes** |

### Cron Expression Examples

| Expression | Meaning |
|------------|---------|
| `0 2 * * *` | Daily at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Every Sunday at midnight |
| `30 14 * * 1-5` | Weekdays at 2:30 PM |

### Validation Flow

```mermaid
graph TD
    A[User enters cron expression] --> B{Valid syntax?}
    B -->|No| C[Display error]
    B -->|Yes| D[Save to database]
    D --> E{scheduleEnabled = true?}
    E -->|Yes| F[Apply to scheduler]
    E -->|No| G[Store but don't schedule]
    F --> H[Task scheduled]
    G --> I[No active task]

    style C fill:#ffcdd2
    style H fill:#c8e6c9
```

### Directory Selection

```mermaid
sequenceDiagram
    participant User
    participant Settings
    participant IPC
    participant Dialog as Native Dialog

    User->>Settings: Click "Select Folder" button
    Settings->>IPC: dialog:selectDirectory
    IPC->>Dialog: electron.dialog.showOpenDialog<br/>({ properties: ['openDirectory'] })
    Dialog-->>User: Show native folder picker
    User->>Dialog: Select folder
    Dialog-->>IPC: ["/selected/path"]
    IPC-->>Settings: "/selected/path"
    Settings->>IPC: settings:set('backupRootPath', path)
    Settings->>Settings: Update input field
```

---

## 5. Backup History Viewing

### Purpose
Display past backup jobs with timestamps, status, and error messages.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant IPC
    participant DB as Database

    User->>Dashboard: Navigate to Dashboard

    Dashboard->>IPC: backup:history
    IPC->>DB: SELECT * FROM sync_jobs<br/>ORDER BY started_at DESC<br/>LIMIT 50
    DB-->>IPC: [<br/>  { id: 3, started_at: "...", status: "success", ... },<br/>  { id: 2, started_at: "...", status: "failed", ... },<br/>  { id: 1, started_at: "...", status: "success", ... }<br/>]
    IPC-->>Dashboard: jobs array

    Dashboard->>Dashboard: Render table

    Dashboard-->>User: Display history

    opt User clicks on failed job
        Dashboard->>Dashboard: Show error details tooltip
    end
```

### History Table Columns

| Column | Data | Example |
|--------|------|---------|
| **ID** | Job identifier | `#42` |
| **Started At** | Formatted timestamp | `Jan 15, 2025 2:00 AM` |
| **Finished At** | Formatted timestamp | `Jan 15, 2025 2:05 AM` |
| **Duration** | Calculated | `5m 23s` |
| **Status** | Badge | 🟢 Success / 🔴 Failed / 🟡 Running |
| **Pages** | Page count | `42 pages` |
| **Error** | Error message (if failed) | `Notion API rate limit` |

### Status Indicators

```mermaid
graph LR
    subgraph Status Colors
        A[🟢 Success] --> A1[Green badge]
        B[🔴 Failed] --> B1[Red badge]
        C[🟡 Running] --> C1[Yellow badge]
    end

    style A fill:#c8e6c9
    style B fill:#ffcdd2
    style C fill:#fff9c4
```

---

## 6. Page Hierarchy to Filesystem Mapping

### Purpose
Transform Notion's nested page structure into a corresponding directory hierarchy.

### Transformation Flow

```mermaid
graph TD
    A[Notion Workspace] --> B{Fetch root pages}
    B --> C[Page: Project Docs]
    B --> D[Page: Meeting Notes]

    C --> E{Fetch children}
    E --> F[Child: Architecture]
    E --> G[Child: API Reference]

    F --> H{Fetch children}
    H --> I[Grandchild: Diagrams]

    subgraph Filesystem Output
        J[/backup-root/]
        K[/Project Docs/]
        L[/Project Docs/root.md]
        M[/Project Docs/Architecture/]
        N[/Project Docs/Architecture/root.md]
        O[/Project Docs/Architecture/Diagrams/]
        P[/Project Docs/Architecture/Diagrams/root.md]
        Q[/Meeting Notes/]
        R[/Meeting Notes/root.md]
    end

    C --> K
    C --> L
    F --> M
    F --> N
    I --> O
    I --> P
    D --> Q
    D --> R

    style J fill:#e3f2fd
    style K fill:#e3f2fd
    style L fill:#fff3e0
    style M fill:#e3f2fd
    style N fill:#fff3e0
    style O fill:#e3f2fd
    style P fill:#fff3e0
    style Q fill:#e3f2fd
    style R fill:#fff3e0
```

### Filename Sanitization

```mermaid
graph LR
    A["Input: 'Project/Plan: 2025 *DRAFT*'"] --> B[Remove: / \ : * ? \" < > |]
    B --> C["'Project Plan 2025 DRAFT'"]
    C --> D[Collapse multiple spaces]
    D --> E["'Project Plan 2025 DRAFT'"]
    E --> F[Trim whitespace]
    F --> G[Limit to 200 chars]
    G --> H["Output: 'Project Plan 2025 DRAFT'"]

    style A fill:#ffcdd2
    style H fill:#c8e6c9
```

### Page Processing Algorithm

```mermaid
flowchart TD
    Start[processNode: PageNode] --> CheckContent{Has markdown<br/>content?}

    CheckContent -->|Yes| CreateDir[Create directory<br/>for this page]
    CheckContent -->|No| CreateDir

    CreateDir --> WriteFile{Content length > 0?}
    WriteFile -->|Yes| Write[Write root.md]
    WriteFile -->|No| Skip[Skip file write<br/>directory only]

    Write --> RecordDB[Record in<br/>sync_job_pages]
    Skip --> RecordDB

    RecordDB --> CheckChildren{Has children?}
    CheckChildren -->|Yes| Loop[For each child:<br/>recursively call<br/>processNode]
    CheckChildren -->|No| Done[Done]

    Loop --> Done

    style Start fill:#e3f2fd
    style CreateDir fill:#fff3e0
    style Write fill:#c8e6c9
    style RecordDB fill:#f3e5f5
    style Done fill:#e3f2fd
```

---

## 7. Notion Block to Markdown Conversion

### Purpose
Convert Notion's proprietary block format to standard Markdown.

### Supported Block Types

```mermaid
graph LR
    subgraph "Notion Blocks"
        NB1[paragraph]
        NB2[heading_1/2/3]
        NB3[bulleted_list_item]
        NB4[numbered_list_item]
        NB5[to_do]
        NB6[code]
        NB7[quote]
        NB8[divider]
    end

    subgraph "Markdown Output"
        MD1[Plain text]
        MD2[# / ## / ###]
        MD3[- item]
        MD4[1. item]
        MD5[- [ ] / - [x]]
        MD6[```lang<br/>code<br/>```]
        MD7[> quote]
        MD8[---]
    end

    NB1 --> MD1
    NB2 --> MD2
    NB3 --> MD3
    NB4 --> MD4
    NB5 --> MD5
    NB6 --> MD6
    NB7 --> MD7
    NB8 --> MD8

    style NB1 fill:#e3f2fd
    style NB2 fill:#e3f2fd
    style NB3 fill:#e3f2fd
    style NB4 fill:#e3f2fd
    style NB5 fill:#e3f2fd
    style NB6 fill:#e3f2fd
    style NB7 fill:#e3f2fd
    style NB8 fill:#e3f2fd

    style MD1 fill:#c8e6c9
    style MD2 fill:#c8e6c9
    style MD3 fill:#c8e6c9
    style MD4 fill:#c8e6c9
    style MD5 fill:#c8e6c9
    style MD6 fill:#c8e6c9
    style MD7 fill:#c8e6c9
    style MD8 fill:#c8e6c9
```

### Conversion Examples

**Paragraph**:
```
Notion: { type: "paragraph", paragraph: { rich_text: [{ text: { content: "Hello world" } }] } }
Markdown: Hello world
```

**Heading**:
```
Notion: { type: "heading_2", heading_2: { rich_text: [{ text: { content: "Section" } }] } }
Markdown: ## Section
```

**Code Block**:
```
Notion: { type: "code", code: { language: "javascript", rich_text: [{ text: { content: "const x = 1;" } }] } }
Markdown: ```javascript
const x = 1;
```
```

**To-Do**:
```
Notion: { type: "to_do", to_do: { checked: true, rich_text: [{ text: { content: "Task" } }] } }
Markdown: - [x] Task
```

### Unsupported Blocks

| Block Type | Behavior |
|------------|----------|
| `image` | Skipped (future: download and reference) |
| `file` | Skipped |
| `video` | Skipped |
| `embed` | Skipped |
| `bookmark` | Skipped |
| `table` | Skipped (complex structure) |
| `child_page` | Processed as separate directory |
| `child_database` | Skipped |

---

## 8. Error Handling Workflow

### Purpose
Gracefully handle failures at various stages of the backup process.

### Error Categories

```mermaid
graph TD
    Errors[Backup Errors] --> Auth[Authentication Errors]
    Errors --> Network[Network Errors]
    Errors --> FS[Filesystem Errors]
    Errors --> API[API Errors]

    Auth --> Auth1[Invalid Notion token]
    Auth --> Auth2[Token expired]

    Network --> Net1[No internet connection]
    Network --> Net2[Notion API unreachable]
    Network --> Net3[Timeout fetching page]

    FS --> FS1[Backup path doesn't exist]
    FS --> FS2[No write permission]
    FS --> FS3[Disk full]

    API --> API1[Rate limit exceeded]
    API --> API2[Page not found]
    API --> API3[Malformed API response]

    style Auth1 fill:#ffcdd2
    style Auth2 fill:#ffcdd2
    style Net1 fill:#ffcdd2
    style Net2 fill:#ffcdd2
    style Net3 fill:#ffcdd2
    style FS1 fill:#ffcdd2
    style FS2 fill:#ffcdd2
    style FS3 fill:#ffcdd2
    style API1 fill:#ffcdd2
    style API2 fill:#ffcdd2
    style API3 fill:#ffcdd2
```

### Error Recovery Strategy

```mermaid
flowchart TD
    Start[Backup running] --> Error{Error occurs}

    Error -->|Authentication| Auth[Stop entire backup<br/>Job status = 'failed']
    Error -->|Network| Network{Retryable?}
    Error -->|Filesystem| FS[Stop entire backup<br/>Job status = 'failed']
    Error -->|Single page fails| Page[Log error in sync_job_pages<br/>Continue with other pages]

    Network -->|Yes| Retry[Retry 3 times<br/>with exponential backoff]
    Network -->|No| NetworkFail[Skip page<br/>Continue backup]

    Retry --> Success{Retry successful?}
    Success -->|Yes| Continue[Continue backup]
    Success -->|No| NetworkFail

    Page --> Check{All pages failed?}
    Check -->|Yes| AllFailed[Job status = 'failed']
    Check -->|No| PartialSuccess[Job status = 'success'<br/>with failed page records]

    style Auth fill:#ffcdd2
    style FS fill:#ffcdd2
    style AllFailed fill:#ffcdd2
    style PartialSuccess fill:#fff9c4
    style Continue fill:#c8e6c9
```

### Error Recording

```sql
-- Failed job example
INSERT INTO sync_jobs (started_at, finished_at, status, error) VALUES
  ('2025-01-15T02:00:00.000Z', '2025-01-15T02:00:05.123Z', 'failed', 'Notion API: Unauthorized (invalid token)');

-- Failed page example
INSERT INTO sync_job_pages (job_id, notion_id, title, local_path, status, error) VALUES
  (42, 'abc-123', 'Roadmap 2025', 'Roadmap 2025', 'failed', 'Network timeout after 3 retries');
```

---

## Summary

The main workflows in Notion Backup MD follow a consistent pattern:

1. **User/System Trigger**: Manual click or scheduled timer
2. **Settings Validation**: Ensure configuration is valid
3. **Database Transaction**: Create job record
4. **Content Fetching**: Call Notion API with pagination
5. **Conversion & Storage**: Transform to Markdown, write to disk
6. **Progress Tracking**: Update database and optionally emit UI events
7. **Completion**: Finalize job record with status

Key design principles:
- **Resilience**: Continue on single-page failures
- **Auditability**: Record all operations in database
- **User Feedback**: Real-time progress for manual backups
- **Automation**: Silent scheduled backups
- **Extensibility**: Plugin architecture for new providers/storage

All workflows maintain data integrity through SQLite transactions and provide detailed error messages for troubleshooting.
