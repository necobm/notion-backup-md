import { Client } from '@notionhq/client'
import type {
  PageObjectResponse,
  BlockObjectResponse
} from '@notionhq/client/build/src/api-endpoints'
import type { ISourceProvider, PageNode } from './ISourceProvider'

function getPageTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find((p) => p.type === 'title')
  if (titleProp?.type === 'title') {
    return titleProp.title.map((t) => t.plain_text).join('') || 'Untitled'
  }
  return 'Untitled'
}

function blocksToMarkdown(blocks: BlockObjectResponse[]): string {
  const lines: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        lines.push(block.paragraph.rich_text.map((t) => t.plain_text).join(''))
        break
      case 'heading_1':
        lines.push(`# ${block.heading_1.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'heading_2':
        lines.push(`## ${block.heading_2.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'heading_3':
        lines.push(`### ${block.heading_3.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'bulleted_list_item':
        lines.push(`- ${block.bulleted_list_item.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'numbered_list_item':
        lines.push(`1. ${block.numbered_list_item.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'to_do':
        const checked = block.to_do.checked ? '[x]' : '[ ]'
        lines.push(`- ${checked} ${block.to_do.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'code':
        const lang = block.code.language
        lines.push(`\`\`\`${lang}\n${block.code.rich_text.map((t) => t.plain_text).join('')}\n\`\`\``)
        break
      case 'quote':
        lines.push(`> ${block.quote.rich_text.map((t) => t.plain_text).join('')}`)
        break
      case 'divider':
        lines.push('---')
        break
      case 'child_page':
        // child pages are handled as separate PageNodes, not inlined
        break
      default:
        // unsupported block types silently skipped
        break
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

export class NotionProvider implements ISourceProvider {
  private client: Client

  constructor(token: string) {
    this.client = new Client({ auth: token })
  }

  async fetchRootPages(): Promise<import('./ISourceProvider').PageNode[]> {
    const response = await this.client.search({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    })

    const rootPages: import('./ISourceProvider').PageNode[] = []
    for (const result of response.results) {
      if (result.object !== 'page') continue
      const page = result as PageObjectResponse
      // only include pages without a parent page (true root pages)
      if (page.parent.type === 'workspace' || page.parent.type === 'page') {
        if (page.parent.type === 'workspace') {
          rootPages.push(await this.fetchPageTree(page.id))
        }
      }
    }
    return rootPages
  }

  async fetchPageTree(pageId: string): Promise<import('./ISourceProvider').PageNode> {
    const page = (await this.client.pages.retrieve({ page_id: pageId })) as PageObjectResponse
    const title = getPageTitle(page)

    // Fetch all blocks (paginated)
    const allBlocks: BlockObjectResponse[] = []
    let cursor: string | undefined
    do {
      const resp = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100
      })
      allBlocks.push(...(resp.results as BlockObjectResponse[]))
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
    } while (cursor)

    // Separate child pages from content blocks
    const childPageBlocks = allBlocks.filter((b) => b.type === 'child_page')
    const contentBlocks = allBlocks.filter((b) => b.type !== 'child_page')

    const markdownContent = blocksToMarkdown(contentBlocks)

    // Recursively fetch children
    const children = await Promise.all(
      childPageBlocks.map((b) => this.fetchPageTree(b.id))
    )

    return { id: pageId, title, markdownContent, children }
  }
}
