import type { Tool, ToolResult, OpenAIToolDefinition } from '../types';

const definition: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'now',
    description: 'Get the current date and time. Use this when user asks for current time, today\'s date, or what time is it.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

async function execute(): Promise<ToolResult> {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  };
  
  const formatter = new Intl.DateTimeFormat('id-ID', options);
  const formatted = formatter.format(now);
  
  const unix = Math.floor(now.getTime() / 1000);
  
  return {
    success: true,
    result: `${formatted}\n\nUnix Timestamp: ${unix}`
  };
}

export const nowTool: Tool = {
  name: 'now',
  description: definition.function.description,
  parameters: definition.function.parameters,
  execute
};

export const nowDefinition = definition;
