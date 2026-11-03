export async function* textDeltas(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  let done = false;
  function event(): string | undefined {
    const payload = data.join('\n'); data = [];
    if (!payload) return;
    if (payload.trim() === '[DONE]') { done = true; return; }
    const value = JSON.parse(payload);
    if (value.error || value.choices?.[0]?.error) throw new Error('Stream penyedia gagal.');
    const content: unknown = value.choices?.[0]?.delta?.content;
    if (typeof content === 'string') return content;
  }
  try {
    while (!done) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      if (buffer.length > 65536) throw new Error('Stream terlalu besar.');
      if (result.done) buffer += '\n\n';
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
        if (!line) { const content = event(); if (content) yield content; if (done) break; }
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (result.done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
