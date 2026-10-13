function badJson(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: true, message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Read JSON with a real byte cap even when Content-Length is absent. */
export async function boundedJson(request: Request, maxBytes = 4096): Promise<unknown | Response> {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return badJson('JSON diperlukan.', 415);
  }
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) {
    return badJson('Permintaan terlalu besar.', 413);
  }
  try {
    const reader = request.body?.getReader();
    if (!reader) return badJson('JSON tidak sah.', 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return badJson('Permintaan terlalu besar.', 413);
      }
      chunks.push(value);
    }
    const bodyBytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)) as unknown;
  } catch {
    return badJson('JSON tidak sah.', 400);
  }
}
