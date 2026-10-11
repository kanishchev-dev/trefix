import { useEffect, useMemo, useRef } from "react";
import {
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { createCoachSession, streamCoachMessage } from "../../lib/coach-api";
import { resolveApiErrorMessage } from "@workspace/utils";

import { logger } from "../../lib/logger";

type RuntimeMessage = {
  role?: "user" | "assistant" | "system" | "tool";
  content?: Array<{ type?: "text"; text?: string }>;
};

function extractText(message?: RuntimeMessage): string {
  return (
    message?.content
      ?.map((part) => (part.type === "text" ? (part.text ?? "") : ""))
      .join("\n")
      .trim() ?? ""
  );
}

function getPrompt(messages: readonly RuntimeMessage[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return extractText(lastUserMessage);
}

export function useTrefixRuntime(
  athleteId: string | undefined,
  sessionId: string | null,
  initialMessages: ThreadMessageLike[],
  texts: { athleteMissing: string; unavailable: string; network: string },
) {
  const sessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const chatModel = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        if (!athleteId) {
          yield {
            content: [{ type: "text", text: texts.athleteMissing }],
          };
          return;
        }

        const prompt = getPrompt(
          messages as unknown as readonly RuntimeMessage[],
        );

        try {
          if (!sessionIdRef.current) {
            const session = await createCoachSession({
              athleteId: athleteId,
              title: prompt.slice(0, 40),
            });
            sessionIdRef.current = session.id;
          }

          const stream = await streamCoachMessage(
            sessionIdRef.current,
            prompt,
            abortSignal,
          );
          let fullText = "";

          for await (const chunk of stream) {
            if (abortSignal.aborted) return;
            if (chunk.delta) {
              fullText += chunk.delta;
              yield { content: [{ type: "text", text: fullText }] };
            }
          }
        } catch (error) {
          logger.error("[ChatModel] Error:", error);
          yield {
            content: [
              {
                type: "text",
                // Backend messages (coach off, session gone) are already localized.
                text: resolveApiErrorMessage(error, {
                  byStatus: (status) =>
                    status >= 500 ? texts.unavailable : undefined,
                  network: texts.network,
                  fallback: texts.unavailable,
                }),
              },
            ],
          };
        }
      },
    }),
    [athleteId, texts],
  );

  return useLocalRuntime(chatModel, {
    initialMessages,
  });
}
