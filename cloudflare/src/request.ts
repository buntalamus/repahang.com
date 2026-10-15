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

/**
 * getJsonInput() from PHP: the body is decoded whatever the Content-Type, and
 * anything that is not a JSON object/array becomes an empty object so the
 * endpoint's own field validation answers. A real byte cap still applies.
 */
export async function boundedJson(request: Request, maxBytes = 4096): Promise<unknown | Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) {
    return badJson('Permintaan terlalu besar.', 413);
  }
  try {
    const reader = request.body?.getReader();
    if (!reader) return {};
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
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
