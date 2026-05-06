# Notion Backup MD - Documentation

Welcome to the Notion Backup MD documentation! This directory contains comprehensive technical documentation about the application's architecture, technologies, database design, and workflows.

## Documentation Structure

### 📐 [01 - Architecture Overview](./01-architecture-overview.md)
High-level architecture of the application, including:
- Electron multi-process architecture (Main, Preload, Renderer)
- Core components and their responsibilities
- Security model and process isolation
- Data flow and IPC communication
- Extensibility architecture (Strategy Pattern)
- Component diagrams and interactions

**Read this first** if you want to understand how the application is structured and how components interact.

### 🛠️ [02 - Technologies Used](./02-technologies.md)
Complete overview of the technology stack, including:
- Core technologies (Electron, React, TypeScript)
- Build tools (Vite, electron-builder)
- Backend technologies (SQLite, node-cron)
- External APIs (@notionhq/client)
- Development tools (ESLint, Prettier)
- Platform-specific considerations
- Architecture decisions and rationale

**Read this** if you want to know what technologies power the application and why they were chosen.

### 🗄️ [03 - Database Entities](./03-database-entities.md)
Detailed database schema documentation, including:
- Entity-relationship diagrams
- Table schemas with all columns and constraints
- Data types and validation rules
- Relationships and foreign keys
- Migration system
- Access patterns and performance considerations
- Type safety with TypeScript interfaces

**Read this** if you want to understand the data model, database structure, or need to work with stored data.

### 🔄 [04 - Main Workflows](./04-main-workflows.md)
Comprehensive workflow documentation with sequence diagrams:
- Application startup process
- Manual backup workflow
- Scheduled backup workflow
- Settings management
- Backup history viewing
- Page hierarchy to filesystem mapping
- Notion block to Markdown conversion
- Error handling strategies

**Read this** if you want to understand how the application operates, how data flows through the system, or how to troubleshoot issues.

## Quick Navigation

### For New Contributors
1. Start with [Architecture Overview](./01-architecture-overview.md) to understand the overall structure
2. Review [Technologies Used](./02-technologies.md) to familiarize yourself with the stack
3. Read [Main Workflows](./04-main-workflows.md) to understand how features work

### For Database Work
- [Database Entities](./03-database-entities.md) - Schema, migrations, and data model
- See `src/main/db/migrations.ts` for migration code
- See `src/main/db/settings.ts` for settings management

### For Feature Development
- [Architecture Overview](./01-architecture-overview.md) - Component interactions
- [Main Workflows](./04-main-workflows.md) - How features currently work
- [Technologies Used](./02-technologies.md) - Development commands and tools

### For Troubleshooting
- [Main Workflows](./04-main-workflows.md) - Error handling section
- [Database Entities](./03-database-entities.md) - Data integrity and constraints
- [Architecture Overview](./01-architecture-overview.md) - IPC contract and security model

## Diagram Formats

All diagrams in this documentation are created using **Mermaid**, a text-based diagramming tool that renders beautiful diagrams from markdown-like syntax.

### Viewing Diagrams

Mermaid diagrams are supported natively by:
- GitHub (renders automatically in README files)
- GitLab
- Visual Studio Code (with Mermaid extension)
- Many documentation platforms

### Diagram Types Used

- **Flowcharts**: Process flows and decision trees
- **Sequence Diagrams**: Component interactions over time
- **Entity-Relationship Diagrams**: Database schema
- **State Diagrams**: State transitions
- **Graph Diagrams**: Component relationships

## Key Concepts

### Process Separation
The application strictly separates the **Main Process** (Node.js backend with file/database access) from the **Renderer Process** (React UI in a sandboxed environment). They communicate only through well-defined IPC channels.

### Strategy Pattern
The application uses interfaces (`ISourceProvider`, `IStorage`) to enable extensibility. You can add new content sources (beyond Notion) or storage backends (beyond local filesystem) without modifying core backup logic.

### Event-Driven Progress
During backups, progress events flow from the main process to the renderer via IPC, enabling real-time UI updates without blocking the backup operation.

### ACID Transactions
All database operations use SQLite transactions to ensure data consistency, even if the application crashes during a backup.

## Development Commands

See [CLAUDE.md](../CLAUDE.md) in the root directory for:
- Development server commands
- Build and packaging instructions
- Linting and type-checking
- Native module recompilation

## Additional Resources

- **Source Code**: Explore `src/` directory for implementation details
- **CLAUDE.md**: Development guidelines and commands (in root directory)
- **package.json**: Dependencies and scripts
- **electron-builder.yml**: Packaging configuration
- **tsconfig.json**: TypeScript configuration

## Contributing to Documentation

When updating documentation:

1. **Keep diagrams in Mermaid format** - Easy to edit and version control
2. **Update all affected documents** - Changes may impact multiple files
3. **Test diagram rendering** - Verify Mermaid syntax is valid
4. **Maintain consistency** - Follow existing structure and terminology
5. **Add examples** - Code snippets and real-world scenarios help understanding

## Questions or Issues?

If you find documentation unclear or incorrect:
- Open an issue on GitHub
- Suggest improvements via pull request
- Refer to the source code for ground truth

---

**Documentation Version**: 1.0
**Last Updated**: January 2025
**Application Version**: Based on current codebase state
