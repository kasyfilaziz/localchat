import type { Tool, ToolResult, OpenAIToolDefinition } from '../types';
import { CORS_PROXY, BRAVE_SEARCH_URL } from '../types';
import { webFetchTool } from './webFetch';

const definition: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'webSearch',
    description: 'Search the web using Brave Search. Use this when user wants to find information, news, or answers online.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      required: ['query']
    }
  }
};

function extractSearchResults(html: string): string {
  const results: string[] = [];
  
  const snippetRegex = /<div[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  
  const titleRegex = /<h3[^>]*>([^<]+)<\/h3>/gi;
  
  let titleMatch;
  const titles: string[] = [];
  while ((titleMatch = titleRegex.exec(html)) !== null) {
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (title) titles.push(title);
  }
  
  const urlRegex = /\/url\?q=([^&"]+)/g;
  const urls: string[] = [];
  let urlMatch;
  while ((urlMatch = urlRegex.exec(html)) !== null) {
    urls.push(decodeURIComponent(urlMatch[1]));
  }
  
  const descRegex = /<p[^>]*>([^<]+)<\/p>/gi;
  const descriptions: string[] = [];
  let descMatch;
  let count = 0;
  while ((descMatch = descRegex.exec(html)) !== null && count < 10) {
    const desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
    if (desc && desc.length > 20) {
      descriptions.push(desc.slice(0, 200));
      count++;
    }
  }

  for (let i = 0; i < Math.min(10, titles.length); i++) {
    let result = `${i + 1}. ${titles[i]}`;
    if (urls[i]) result += `\n   URL: ${urls[i]}`;
    if (descriptions[i]) result += `\n   ${descriptions[i].slice(0, 150)}...`;
    results.push(result);
  }

  if (results.length === 0) {
    const plainText = html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
    const lines = plainText.split('\n').filter(l => l.trim().length > 10);
    return lines.slice(0, 10).join('\n\n');
  }

  return results.join('\n\n');
}

async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const query = params.query as string;
  
  if (!query) {
    return {
      success: false,
      error: 'Query is required'
    };
  }

  const searchUrl = BRAVE_SEARCH_URL + encodeURIComponent(query);
  
  const fetchResult = await webFetchTool.execute({ url: searchUrl });
  
  if (!fetchResult.success || !fetchResult.result) {
    return {
      success: false,
      error: fetchResult.error || 'Failed to search'
    };
  }

  try {
    const results = extractSearchResults(fetchResult.result);
    
    if (!results || results.trim().length < 10) {
      return {
        success: false,
        error: 'Could not parse search results'
      };
    }

    return {
      success: true,
      result: `Search results for "${query}":\n\n${results}`
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to parse results'
    };
  }
}

export const webSearchTool: Tool = {
  name: 'webSearch',
  description: definition.function.description,
  parameters: definition.function.parameters,
  execute
};

export const webSearchDefinition = definition;
