import type { Tool, ToolResult, OpenAIToolDefinition } from '../types';

const definition: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'calculator',
    description: 'Calculate a mathematical expression. Supports: +, -, *, /, %, ** (power), parentheses. Use for arithmetic calculations.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5", "(3 + 4) * 2")'
        }
      },
      required: ['expression']
    }
  }
};

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  
  for (const char of expr) {
    if (/[\s]/.test(char)) {
      if (current) tokens.push(current);
      current = '';
    } else if (/[0-9.]/.test(char)) {
      current += char;
    } else if (/[+\-*/%()]/.test(char)) {
      if (current) tokens.push(current);
      tokens.push(char);
    } else if (char === '*' && expr.indexOf('*') !== -1) {
      if (current) tokens.push(current);
      if (expr[expr.indexOf('*') + 1] === '*') {
        tokens.push('**');
      }
      current = '';
    } else {
      throw new Error(`Invalid character: ${char}`);
    }
  }
  if (current) tokens.push(current);
  
  return tokens;
}

function parse(tokens: string[]): number {
  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
      const op = tokens[pos++];
      const right = parsePower();
      switch (op) {
        case '*': result = result * right; break;
        case '/': 
          if (right === 0) throw new Error('Division by zero');
          result = result / right; 
          break;
        case '%': result = result % right; break;
      }
    }
    
    return result;
  }

  function parsePower(): number {
    const base = parsePrimary();
    
    if (pos < tokens.length && tokens[pos] === '**') {
      pos++;
      const exponent = parsePower();
      return Math.pow(base, exponent);
    }
    
    return base;
  }

  function parsePrimary(): number {
    const token = tokens[pos];
    
    if (token === undefined) {
      throw new Error('Unexpected end of expression');
    }
    
    if (token === '(') {
      pos++;
      const result = parseExpression();
      if (tokens[pos] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      pos++;
      return result;
    }
    
    if (!/^-?\d+(\.\d+)?$/.test(token)) {
      throw new Error(`Invalid token: ${token}`);
    }
    
    pos++;
    return parseFloat(token);
  }

  return parseExpression();
}

async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const expression = (params.expression as string)?.trim();
  
  if (!expression) {
    return {
      success: false,
      error: 'Expression is required'
    };
  }

  try {
    const sanitized = expression.replace(/[^0-9+\-*/%(). ]/g, '');
    const tokens = tokenize(sanitized);
    const result = parse(tokens);
    
    return {
      success: true,
      result: `${expression} = ${result}`
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid expression'
    };
  }
}

export const calculatorTool: Tool = {
  name: 'calculator',
  description: definition.function.description,
  parameters: definition.function.parameters,
  execute
};

export const calculatorDefinition = definition;
