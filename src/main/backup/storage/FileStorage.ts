import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { IStorage } from './IStorage'

export class FileStorage implements IStorage {
  constructor(private readonly rootPath: string) {}

  async ensureDir(relativePath: string): Promise<void> {
    await mkdir(join(this.rootPath, relativePath), { recursive: true })
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    await writeFile(join(this.rootPath, relativePath), content, 'utf-8')
  }
}
