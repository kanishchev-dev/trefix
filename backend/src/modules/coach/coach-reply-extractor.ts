const REPLY_FIELD = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)/;

/**
 * Pulls the `reply` string out of a structured JSON response while it is
 * still streaming, so the user sees text before the JSON is complete.
 */
export class ReplyFieldExtractor {
  private buffer = '';
  private emittedLength = 0;

  /** Appends a raw chunk and returns the reply text that became visible, if any. */
  push(chunk: string): string {
    this.buffer += chunk;
    const match = this.buffer.match(REPLY_FIELD);
    if (!match?.[1]) {
      return '';
    }

    let reply: string;
    try {
      reply = JSON.parse(`"${match[1]}"`) as string;
    } catch {
      // A partial escape sequence: unescape the common cases by hand and hold
      // back output that ends in the middle of an escape.
      reply = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (reply.slice(this.emittedLength).endsWith('\\')) {
        return '';
      }
    }

    const delta = reply.slice(this.emittedLength);
    if (delta) {
      this.emittedLength = reply.length;
    }
    return delta;
  }

  /** The text of `full` not yet emitted. */
  remainder(full: string): string {
    return full.slice(this.emittedLength);
  }

  /** The complete JSON document, or null when it does not parse. */
  parse<T>(): T | null {
    try {
      return JSON.parse(this.buffer) as T;
    } catch {
      return null;
    }
  }

  tail(length: number): string {
    return this.buffer.slice(-length);
  }
}
