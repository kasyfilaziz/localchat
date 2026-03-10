import type { Tool, ToolResult, OpenAIToolDefinition } from '../types';

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

const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': randomUA,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchContent(
  url: string, 
  attempt: number = 1, 
  proxyIndex: number = 0,
  useProxy: boolean = true
): Promise<ToolResult> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let finalUrl = url;
  if (useProxy && proxyIndex < PROXIES.length) {
    finalUrl = PROXIES[proxyIndex] + encodeURIComponent(url);
  } else {
    useProxy = false; // No more proxies to try
  }

  try {
    console.log(`[webFetch] Attempt ${attempt}, Proxy: ${useProxy ? PROXIES[proxyIndex] : 'Direct'}, URL: ${url}`);
    const response = await fetchWithTimeout(finalUrl, TIMEOUT_MS);
    
    if (!response.ok) {
      // If we get 403 or 429 and were using proxy, try next proxy immediately
      if ((response.status === 403 || response.status === 429) && useProxy) {
        console.warn(`[webFetch] HTTP ${response.status} with proxy ${PROXIES[proxyIndex]}, trying next proxy...`);
        return fetchContent(url, attempt, proxyIndex + 1, true);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      content = JSON.stringify(json, null, 2);
    } else {
      const text = await response.text();
      content = text.slice(0, 20000); // Take more initial content for parsing
      
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No title';
      
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      let bodyText = bodyMatch ? bodyMatch[1] : text;
      
      bodyText = bodyText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000);

      content = `Title: ${title}\n\nContent:\n${bodyText}`;
    }

    return {
      success: true,
      result: content
    };
  } catch (err) {
    // If it's a proxy error, try next proxy
    if (useProxy && proxyIndex < PROXIES.length - 1) {
      return fetchContent(url, attempt, proxyIndex + 1, true);
    }

    // If it's a direct fetch error or last proxy failed, use standard retry loop
    if (attempt < MAX_RETRIES) {
      console.log(`[webFetch] Attempt ${attempt} failed, retrying in ${attempt}s...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return fetchContent(url, attempt + 1, 0, true);
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
