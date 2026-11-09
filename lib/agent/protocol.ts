import {answerQuestion, type AgentCorpus} from './content';
import {AGENT_TOOLS, callTool} from './tools';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

type RpcMessage = {
  id: unknown;
  hasId: boolean;
  method: string;
  params: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wantsSse(accept: string | null): boolean {
  if (!accept) return false;
  const types = accept.split(',').map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '');
  return types.includes('text/event-stream') && !types.includes('application/json') && !types.includes('*/*');
}

function rpcResponse(accept: string | null, payload: unknown, status = 200): Response {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };
  if (wantsSse(accept)) {
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      status,
      headers: {...cors, 'Content-Type': 'text/event-stream'},
    });
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: {...cors, 'Content-Type': 'application/json; charset=utf-8'},
  });
}

function rpcError(id: unknown, code: number, message: string) {
  return {jsonrpc: '2.0', id, error: {code, message}};
}

function parseRpc(value: unknown): RpcMessage | {error: string} {
  if (!isRecord(value) || typeof value['method'] !== 'string' || value['method'].length === 0) {
    return {error: 'Invalid request'};
  }
  const params = value['params'];
  return {
    id: value['id'] ?? null,
    hasId: Object.prototype.hasOwnProperty.call(value, 'id'),
    method: value['method'],
    params: isRecord(params) ? params : null,
  };
}

function toolResult(id: unknown, text: string) {
  return {jsonrpc: '2.0', id, result: {content: [{type: 'text', text}], isError: false}};
}

export async function handleMcp(request: Request, corpus: AgentCorpus): Promise<Response> {
  const accept = request.headers.get('Accept');
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpcResponse(accept, rpcError(null, -32700, 'Parse error'), 400);
  }
  if (Array.isArray(payload)) return rpcResponse(accept, rpcError(null, -32600, 'Batch requests are not supported'), 400);
  const message = parseRpc(payload);
  if ('error' in message) return rpcResponse(accept, rpcError(null, -32600, message.error), 400);
  if (!message.hasId) return new Response(null, {status: 202, headers: {'Access-Control-Allow-Origin': '*'}});

  if (message.method === 'initialize') {
    const requested = message.params && typeof message.params['protocolVersion'] === 'string' ? message.params['protocolVersion'] : '2025-06-18';
    const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : '2025-06-18';
    return rpcResponse(accept, {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion,
        capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'abdessattar-content', version: '1.0.0'},
      },
    });
  }
  if (message.method === 'ping') return rpcResponse(accept, {jsonrpc: '2.0', id: message.id, result: {}});
  if (message.method === 'tools/list') {
    return rpcResponse(accept, {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: AGENT_TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      },
    });
  }
  if (message.method === 'tools/call') {
    const name = message.params && typeof message.params['name'] === 'string' ? message.params['name'] : '';
    const args = message.params && isRecord(message.params['arguments']) ? message.params['arguments'] : {};
    try {
      return rpcResponse(accept, toolResult(message.id, callTool(corpus, name, args)));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Invalid params';
      return rpcResponse(accept, rpcError(message.id, -32602, text));
    }
  }
  return rpcResponse(accept, rpcError(message.id, -32601, 'Method not found'));
}

function messageText(params: Record<string, unknown> | null): string {
  if (!params) return '';
  const message = params['message'];
  if (!isRecord(message) || !Array.isArray(message['parts'])) return '';
  const texts: string[] = [];
  for (const part of message['parts']) {
    if (isRecord(part) && typeof part['text'] === 'string') texts.push(part['text']);
  }
  return texts.join('\n').trim();
}

export async function handleA2a(request: Request, corpus: AgentCorpus): Promise<Response> {
  const accept = request.headers.get('Accept');
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpcResponse(accept, rpcError(null, -32700, 'Parse error'), 400);
  }
  const message = parseRpc(payload);
  if ('error' in message) return rpcResponse(accept, rpcError(null, -32600, message.error), 400);
  if (!message.hasId) return new Response(null, {status: 202, headers: {'Access-Control-Allow-Origin': '*'}});
  if (message.method !== 'message/send') return rpcResponse(accept, rpcError(message.id, -32601, 'Method not found'));
  const text = answerQuestion(corpus, messageText(message.params));
  return rpcResponse(accept, {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      kind: 'message',
      messageId: crypto.randomUUID(),
      role: 'agent',
      parts: [{kind: 'text', text}],
    },
  });
}
