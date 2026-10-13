import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  Header,
  HeaderBackButton,
  HeaderLogo,
} from "../main/components/header";
import { useTrefixRuntime } from "./use-trefix-runtime";
import { type MainCopy } from "../../locales";
import { useAthlete } from "../main/hooks/use-athlete";
import { BottomFade } from "../../shared/ui/bottom-fade";
import { getLatestCoachSession } from "../../lib/coach-api";
import { styles } from "./trefix-chat.styles";
import { UserMessage, AssistantMessage } from "./components/chat-messages";
import { ComposerDock } from "./components/chat-composer";
import { TrefixEmptyState } from "./components/chat-empty-state";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
  onBack: () => void;
};

type HistoryData = {
  sessionId: string | null;
  messages: ThreadMessageLike[];
};

export function TrefixChatScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: athlete } = useAthlete();
  const [history, setHistory] = useState<HistoryData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const latest = await getLatestCoachSession();
        if (latest) {
          const messages: ThreadMessageLike[] = latest.messages.flatMap((m) =>
            m.role === "tool"
              ? []
              : [
                  {
                    id: m.id,
                    role: m.role,
                    content: [{ type: "text" as const, text: m.content }],
                  },
                ],
          );
          setHistory({ sessionId: latest.session.id, messages });
        } else {
          setHistory({ sessionId: null, messages: [] });
        }
      } catch (e) {
        setHistory({ sessionId: null, messages: [] });
      }
    }
    load();
  }, []);

  const logoSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");

  if (!history) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.color.screen,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.color.screen }]}>
      <Header
        leftAction={
          <HeaderBackButton
            theme={theme}
            themeMode={themeMode}
            onPress={onBack}
          />
        }
        centerContent={<HeaderLogo source={logoSource} />}
        theme={theme}
        themeMode={themeMode}
      />

      <TrefixChatContent
        athleteId={athlete?.id}
        history={history}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
    </View>
  );
}

function TrefixChatContent({
  athleteId,
  history,
  theme,
  themeMode,
  copy,
}: {
  athleteId: string | undefined;
  history: HistoryData;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
}) {
  const runtime = useTrefixRuntime(
    athleteId,
    history.sessionId,
    history.messages,
    copy.errors,
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSurface theme={theme} themeMode={themeMode} copy={copy} />
    </AssistantRuntimeProvider>
  );
}

/** Messages fade into blur from this far above the bottom edge (composer plus a margin). */
const COMPOSER_FADE_HEIGHT = 110;

function ChatSurface({
  theme,
  themeMode,
  copy,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardShell}
    >
      <ThreadPrimitive.Root style={styles.threadRoot}>
        <ThreadPrimitive.MessagesFlatList
          autoScroll
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingTop: 116 + insets.top,
              paddingBottom: 128 + Math.max(insets.bottom, 8),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<TrefixEmptyState theme={theme} copy={copy} />}
        >
          {({ message }) =>
            message.role === "user" ? (
              <UserMessage theme={theme} />
            ) : (
              <AssistantMessage theme={theme} />
            )
          }
        </ThreadPrimitive.MessagesFlatList>

        <BottomFade
          height={Math.max(insets.bottom - 12, 0) + COMPOSER_FADE_HEIGHT}
          theme={theme}
          themeMode={themeMode}
        />
        <ComposerDock
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          bottomOffset={Math.max(insets.bottom - 12, 0)}
        />
      </ThreadPrimitive.Root>
    </KeyboardAvoidingView>
  );
}
