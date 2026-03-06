import type { Tool, ToolCall, ToolCallResult, ToolResult } from './types';
import { nowTool } from './built-in/now';
import { calculatorTool } from './built-in/calculator';
import { webFetchTool } from './built-in/webFetch';
import { webSearchTool } from './built-in/webSearch';

const toolRegistry: Record<string, Tool> = {
  now: nowTool,
  calculator: calculatorTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool
};

export function registerTool(tool: Tool): void {
  toolRegistry[tool.name] = tool;
}

export function getTool(name: string): Tool | undefined {
  return toolRegistry[name];
}

export function getAllTools(): Tool[] {
  return Object.values(toolRegistry);
}

export function getToolDefinitions() {
  return getAllTools().map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export async function executeTool(toolCall: ToolCall): Promise<ToolCallResult> {
  const tool = getTool(toolCall.function.name);
  
  if (!tool) {
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({
        success: false,
        error: `Tool '${toolCall.function.name}' not found`
      })
    };
  }

  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(toolCall.function.arguments);
  } catch {
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({
        success: false,
        error: 'Invalid arguments JSON'
      })
    };
  }

  const result = await tool.execute(params);
  
  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify(result)
  };
}

export async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];
  
  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall);
    results.push(result);
  }
  
  return results;
}

export { toolRegistry };
