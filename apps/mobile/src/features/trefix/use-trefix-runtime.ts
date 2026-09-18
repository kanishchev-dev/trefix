import { useLocalRuntime, type ChatModelAdapter } from "@assistant-ui/react-native";

function wait(ms: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      abortSignal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeoutId);
      resolve();
    }

    abortSignal.addEventListener("abort", onAbort, { once: true });
  });
}

type RuntimeMessage = {
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
};

function extractText(message?: RuntimeMessage): string {
  return (
    message?.content
      ?.map((part) => (part.type === "text" ? part.text ?? "" : ""))
      .join("\n")
      .trim() ?? ""
  );
}

function getPrompt(messages: readonly RuntimeMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return extractText(lastUserMessage);
}

function buildCoachReply(prompt: string): string {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("трен") || normalized.includes("run") || normalized.includes("бег")) {
    return [
      "Сегодня рекомендую лёгкую пробежку.",
      "",
      "Дистанция: 6 км",
      "Темп: 5:40–6:00 мин/км",
      "Интенсивность: зона 2",
      "",
      "Если чувствуешь усталость, сократи объём до 4 км и закончи 4 ускорениями по 15 секунд.",
    ].join("\n");
  }

  if (normalized.includes("восстанов") || normalized.includes("recovery") || normalized.includes("после")) {
    return [
      "После тяжёлой тренировки я бы сделал ставку на восстановление.",
      "",
      "Сегодня:",
      "• 20–30 минут ходьбы",
      "• мобилити для голеностопа и бедра",
      "• сон не меньше 7.5 часов",
      "• белок в течение 1–2 часов после сессии",
    ].join("\n");
  }

  if (normalized.includes("план") || normalized.includes("week") || normalized.includes("недел")) {
    return [
      "Собрал базовый недельный каркас.",
      "",
      "Пн — лёгкий бег",
      "Ср — интервалы",
      "Пт — темповая",
      "Сб — восстановительная сессия",
      "Вс — длинная",
      "",
      "Если хочешь, дальше уточню объём под твой текущий уровень.",
    ].join("\n");
  }

  if (normalized.includes("пит") || normalized.includes("nutrition") || normalized.includes("еда")) {
    return [
      "С питанием сегодня держим простую схему:",
      "",
      "• углеводы за 2–3 часа до тренировки",
      "• вода в течение дня",
      "• белок после нагрузки",
      "",
      "Для вечерней сессии лучше не перегружать ужин жирной едой.",
    ].join("\n");
  }

  return [
    "Разберём это как твой коуч.",
    "",
    "Расскажи немного больше о цели, самочувствии и том, что уже сделал сегодня.",
  ].join("\n");
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const step = cursor < 48 ? 12 : cursor < 140 ? 18 : 24;
    chunks.push(text.slice(cursor, cursor + step));
    cursor += step;
  }

  return chunks;
}

const chatModel: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const prompt = getPrompt(messages as unknown as readonly RuntimeMessage[]);
    const reply = buildCoachReply(prompt);

    let streamed = "";
    for (const chunk of chunkText(reply)) {
      if (abortSignal.aborted) {
        return;
      }

      streamed += chunk;
      await wait(180, abortSignal);

      if (abortSignal.aborted) {
        return;
      }

      yield {
        content: [{ type: "text", text: streamed }],
      };
    }
  },
};

export function useTrefixRuntime() {
  return useLocalRuntime(chatModel);
}
