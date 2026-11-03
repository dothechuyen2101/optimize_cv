"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import type { InterviewErrorCode } from "@/lib/interview/types";
import { pickVoice, speechChunks } from "./speech-text";

// --- Speaking: the browser's own voices (free, instant; quality depends on the device). ---

const NO_VOICES: SpeechSynthesisVoice[] = [];
let cachedVoices = NO_VOICES;

function voicesSnapshot(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return NO_VOICES;
  // getVoices() returns a new array each call; keep one per list so React sees a stable snapshot.
  const voices = window.speechSynthesis.getVoices();
  if (voices.length !== cachedVoices.length) cachedVoices = voices;
  return cachedVoices;
}

function subscribeVoices(onChange: () => void) {
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

export function useSpeechOutput(language: Locale) {
  const voices = useSyncExternalStore(subscribeVoices, voicesSnapshot, () => NO_VOICES);
  const voice = pickVoice(voices, language);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voice) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const chunks = speechChunks(text);
      chunks.forEach((chunk, i) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        if (i === 0) utterance.onstart = () => setSpeaking(true);
        if (i === chunks.length - 1) {
          utterance.onend = () => setSpeaking(false);
          utterance.onerror = () => setSpeaking(false);
        }
        synth.speak(utterance);
      });
    },
    [voice],
  );

  // Leaving the page shouldn't leave the interviewer talking.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { available: voice !== null, speaking, speak, stop };
}

// --- Listening: microphone audio streamed to Deepgram with a temporary token. ---

export type ListenState = "idle" | "connecting" | "listening" | "stopping";
export type VoiceErrorCode = InterviewErrorCode | "mic_denied";

class VoiceFailure extends Error {
  constructor(readonly code: VoiceErrorCode) {
    super(code);
  }
}

const noSubscription = () => () => {};
const micSupported = () =>
  Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined" && typeof WebSocket !== "undefined";

interface Live {
  socket?: WebSocket;
  recorder?: MediaRecorder;
  stream?: MediaStream;
  finals: string[];
}

/** Records one spoken answer; `onText` gets the transcript so far, interim words included. */
export function useSpeechInput(sessionId: string, onText: (text: string) => void) {
  const supported = useSyncExternalStore(noSubscription, micSupported, () => false);
  const [state, setState] = useState<ListenState>("idle");
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const live = useRef<Live>({ finals: [] });
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const release = useCallback(() => {
    const { socket, recorder, stream } = live.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    live.current = { finals: [] };
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    try {
      const response = await fetch(`/api/interviews/${sessionId}/speech-token`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { token?: string; url?: string; code?: InterviewErrorCode } | null;
      if (!response.ok || !data?.token || !data.url) throw new VoiceFailure(data?.code ?? "server");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new VoiceFailure("mic_denied");
      }
      // Browsers can't set headers on a WebSocket; Deepgram reads the token from the subprotocol.
      const socket = new WebSocket(data.url, ["bearer", data.token]);
      live.current = { socket, stream, finals: [] };
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as {
          type?: string;
          is_final?: boolean;
          channel?: { alternatives?: { transcript?: string }[] };
        };
        if (message.type !== "Results") return;
        const words = message.channel?.alternatives?.[0]?.transcript ?? "";
        const { finals } = live.current;
        if (message.is_final && words) finals.push(words);
        onTextRef.current([...finals, message.is_final ? "" : words].filter(Boolean).join(" "));
      };
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new VoiceFailure("server"));
      });
      socket.onerror = () => setError("server");
      socket.onclose = () => {
        release();
        setState("idle");
      };

      const recorder = new MediaRecorder(stream);
      live.current.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) socket.send(event.data);
      };
      // After the last chunk, ask Deepgram for the final words; it then closes the socket.
      recorder.onstop = () => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }));
      };
      recorder.start(250);
      setState("listening");
    } catch (failure) {
      release();
      setError(failure instanceof VoiceFailure ? failure.code : "server");
      setState("idle");
    }
  }, [sessionId, release]);

  const stop = useCallback(() => {
    const { socket, recorder, stream } = live.current;
    setState("stopping");
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    // Deepgram closes after flushing; close it ourselves if it doesn't.
    setTimeout(() => {
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    }, 5000);
  }, []);

  return { supported, state, error, start, stop };
}
