"use client";

import type { AGUIEvent, StreamProtocolAdapter } from "@openuidev/react-headless";

/**
 * Stream protocol adapter: reads NDJSON lines from the Response body
 * and yields parsed AG-UI event objects to @openuidev/react-headless.
 */
export function openClawAdapter(): StreamProtocolAdapter {
  return {
    async *parse(response: Response): AsyncIterable<AGUIEvent> {
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) {
            try { yield JSON.parse(line) as AGUIEvent; } catch { /* skip malformed */ }
          }
        }
      }
      if (buffer.trim()) {
        try { yield JSON.parse(buffer.trim()) as AGUIEvent; } catch { /* skip */ }
      }
    },
  };
}
