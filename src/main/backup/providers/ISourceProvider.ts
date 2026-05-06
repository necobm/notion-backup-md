export interface PageNode {
  id: string
  title: string
  /** Markdown content of this page (may be empty for container pages) */
  markdownContent: string
  children: PageNode[]
}

/**
 * A source provider fetches content from an external service (e.g. Notion).
 * Implement this interface to add new sources.
 */
export interface ISourceProvider {
  /** Returns the top-level pages accessible by the configured credentials. */
  fetchRootPages(): Promise<PageNode[]>
  /**
   * Fetches a single page and recursively fetches its children.
   * Implementations should be recursive.
   */
  fetchPageTree(pageId: string): Promise<PageNode>
}
