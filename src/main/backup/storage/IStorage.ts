/**
 * A storage backend writes backup files to a destination.
 * Implement this interface to add new destinations (e.g. Google Drive, S3).
 */
export interface IStorage {
  /**
   * Writes content to the given relative path inside the backup root.
   * @param relativePath  e.g. "My Page/Child Page/root.md"
   * @param content       UTF-8 string content
   */
  writeFile(relativePath: string, content: string): Promise<void>

  /**
   * Ensures a directory exists at the given relative path.
   */
  ensureDir(relativePath: string): Promise<void>
}
