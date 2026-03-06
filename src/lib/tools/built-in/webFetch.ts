import type { Tool, ToolResult, OpenAIToolDefinition, ToolCallResult } from '../types';
import { CORS_PROXY } from '../types';

const definition: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'webFetch',
    description: 'Fetch the content of a URL. Use this when user wants to read content from a specific webpage. Returns the text content of the page.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from'
        }
      },
      required: ['url']
    }
  }
};

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html, application/xhtml+xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; LocalChat/1.0)'
      }
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchContent(url: string, attempt: number = 1): Promise<ToolResult> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let finalUrl = url;
  if (!url.includes(CORS_PROXY)) {
    finalUrl = CORS_PROXY + encodeURIComponent(url);
  }

  try {
    const response = await fetchWithTimeout(finalUrl, TIMEOUT_MS);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      content = JSON.stringify(json, null, 2);
    } else {
      const text = await response.text();
      content = text.slice(0, 15000);
      
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No title';
      
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      let bodyText = bodyMatch ? bodyMatch[1] : text;
      
      bodyText = bodyText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);

      content = `Title: ${title}\n\nContent:\n${bodyText}`;
    }

    return {
      success: true,
      result: content
    };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return fetchContent(url, attempt + 1);
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch URL'
    };
  }
}

async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const url = params.url as string;
  
  if (!url) {
    return {
      success: false,
      error: 'URL is required'
    };
  }

  return fetchContent(url);
}

export const webFetchTool: Tool = {
  name: 'webFetch',
  description: definition.function.description,
  parameters: definition.function.parameters,
  execute
};

export const webFetchDefinition = definition;
