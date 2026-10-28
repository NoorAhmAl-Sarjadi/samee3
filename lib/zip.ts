/** Read concurrently with compression so writable backpressure cannot deadlock. */
export async function compressZipEntry(data: Uint8Array, signal?: AbortSignal): Promise<{ data: Uint8Array; method: 0 | 8 }> {
  if (signal?.aborted) throw new DOMException('تم إيقاف التنزيل.', 'AbortError')
  if (typeof CompressionStream !== 'function') return { data, method: 0 }
  for (const format of ['deflate-raw', 'deflate'] as const) {
    try {
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream(format), { signal })
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
      const raw = format === 'deflate' ? bytes.subarray(2, bytes.length - 4) : bytes
      if (raw.length && raw.length < data.length) return { data: raw, method: 8 }
      return { data, method: 0 }
    } catch {
      if (signal?.aborted) throw new DOMException('تم إيقاف التنزيل.', 'AbortError')
    }
  }
  return { data, method: 0 }
}