import { loadAuthSession } from "./auth-session";

export interface StreamEvent {
  delta?: string;
  isDone: boolean;
}

export async function fetchSseStream(
  url: string,
  abortSignal?: AbortSignal,
): Promise<AsyncIterableIterator<StreamEvent>> {
  const session = await loadAuthSession();

  return new Promise<AsyncIterableIterator<StreamEvent>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("Accept", "text/event-stream");
    if (session?.accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
    }

    let position = 0;
    let buffer = "";

    const queue: StreamEvent[] = [];
    let resolveNext: ((val: IteratorResult<StreamEvent>) => void) | null = null;
    let isDone = false;

    const push = (event: StreamEvent) => {
      if (resolveNext) {
        resolveNext({ value: event, done: false });
        resolveNext = null;
      } else {
        queue.push(event);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const newData = xhr.responseText.slice(position);
        position = xhr.responseText.length;
        if (newData) {
          console.log(`[Stream] XHR Chunk: ${newData.length} bytes`);
          buffer += newData;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6);
            try {
              const event = JSON.parse(dataStr) as StreamEvent;
              push(event);
            } catch (e) {}
          }
        }
      }

      if (xhr.readyState === 4) {
        isDone = true;
        if (resolveNext) {
          resolveNext({ value: undefined as any, done: true });
        }
      }
    };

    xhr.onerror = () => reject(new Error("XHR Stream Error"));
    xhr.onabort = () => {
      isDone = true;
      if (resolveNext) resolveNext({ value: undefined as any, done: true });
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send();

    const iterable: AsyncIterableIterator<StreamEvent> = {
      next: () => {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift()!, done: false });
        }
        if (isDone) {
          return Promise.resolve({ value: undefined as any, done: true });
        }
        return new Promise((res) => {
          resolveNext = res;
        });
      },
      [Symbol.asyncIterator]: () => iterable,
    };

    resolve(iterable);
  });
}
