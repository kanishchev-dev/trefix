import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

import {
  DEFAULT_VOICE_SETTINGS,
  type VoiceInterval,
  type VoiceSettings,
} from "./cues";
import type { VoiceLanguage } from "./phrases";

const SETTINGS_KEY = "trefix_tracker_voice";
const INTERVALS: VoiceInterval[] = ["1u", "2u", "5min", "10min"];

/**
 * Speaks a cue. The system audio session ducks music under the voice and
 * keeps speaking while the screen is off (background audio mode on iOS).
 * Utterances queue up, so cues of one moment are read one after another.
 */
export function speak(text: string, language: VoiceLanguage): void {
  Speech.speak(text, {
    language: language === "ru" ? "ru-RU" : "en-US",
    useApplicationAudioSession: false,
  });
}

export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}

export async function loadVoiceSettings(): Promise<VoiceSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_VOICE_SETTINGS.enabled,
      interval: INTERVALS.includes(parsed.interval as VoiceInterval)
        ? (parsed.interval as VoiceInterval)
        : DEFAULT_VOICE_SETTINGS.interval,
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export async function saveVoiceSettings(
  settings: VoiceSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A preference; the run goes on with what was picked.
  }
}
