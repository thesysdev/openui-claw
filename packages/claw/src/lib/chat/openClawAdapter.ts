"use client";

// Minimal AG-UI event shapes that @openuidev/react-headless understands.
// Written as NDJSON (one JSON object per line) to the Response body.
export const AGUIEventType = {
  TEXT_MESSAGE_START: "TEXT_MESSAGE_START",
  TEXT_MESSAGE_CONTENT: "TEXT_MESSAGE_CONTENT",
  TEXT_MESSAGE_END: "TEXT_MESSAGE_END",
  RUN_FINISHED: "RUN_FINISHED",
  RUN_ERROR: "RUN_ERROR",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function openClawAdapter(): any {
  return {
    async *parse(response: Response): AsyncIterable<unknown> {
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
            try {
              yield JSON.parse(line);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim());
        } catch {
          // skip
        }
      }
    },
  };
}
