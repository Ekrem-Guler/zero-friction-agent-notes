"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, ArrowUp, Square, X, Loader2, Sparkles } from "lucide-react";
import type { ClientNote } from "@/lib/serializers";

const MAX_CHARS = 500;
const MAX_VOICE_SECONDS = 45;

interface CaptureBarProps {
  activeProjectId: string;
  activeProjectName: string;
  onNoteCreated: (note: ClientNote) => void;
  onError: (msg: string) => void;
}

function getSupportedAudioMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export function CaptureBar({
  activeProjectId,
  activeProjectName,
  onNoteCreated,
  onError,
}: CaptureBarProps) {
  const [text, setText] = useState("");
  const [submittingText, setSubmittingText] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const discardVoiceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeProjectRef = useRef(activeProjectId);

  useEffect(() => {
    activeProjectRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function submitNote() {
    const trimmed = text.trim();
    if (!trimmed || submittingText) return;

    const previousText = text;
    setText("");
    setSubmittingText(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          projectId: activeProjectId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        note?: ClientNote;
        error?: string;
      };
      if (!res.ok || !data.note) {
        setText(previousText);
        onError(data.error || "Not gönderilemedi.");
        return;
      }
      onNoteCreated(data.note);
      inputRef.current?.focus();
    } catch {
      setText(previousText);
      onError("Ağ hatası oluştu.");
    } finally {
      setSubmittingText(false);
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitNote();
    }
  }

  async function startRecording() {
    if (isRecording || uploadingVoice) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onError("Tarayıcınız mikrofon kaydını desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardVoiceRef.current = false;

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);
        setRecordingSeconds(0);

        if (discardVoiceRef.current || chunksRef.current.length === 0) {
          return;
        }

        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        await uploadVoiceBlob(blob, finalMime);
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_VOICE_SECONDS) {
            recorderRef.current?.stop();
            return MAX_VOICE_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      onError("Mikrofon izni alınamadı.");
    }
  }

  function stopAndSendRecording() {
    discardVoiceRef.current = false;
    recorderRef.current?.stop();
  }

  function cancelRecording() {
    discardVoiceRef.current = true;
    recorderRef.current?.stop();
  }

  async function uploadVoiceBlob(blob: Blob, mimeType: string) {
    setUploadingVoice(true);
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append("audio", blob, `voice-note.${ext}`);
      formData.append("projectId", activeProjectRef.current);

      const res = await fetch("/api/notes/voice", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        note?: ClientNote;
        error?: string;
      };
      if (!res.ok || !data.note) {
        onError(data.error || "Sesli not çözümlenemedi.");
        return;
      }
      onNoteCreated(data.note);
    } catch {
      onError("Sesli not yüklenirken bağlantı hatası oluştu.");
    } finally {
      setUploadingVoice(false);
    }
  }

  const formatSeconds = (sec: number) =>
    `00:${sec.toString().padStart(2, "0")}`;

  return (
    <div className="relative rounded-3xl border border-zinc-700/70 bg-[#1e1f20] px-4 py-3 shadow-2xl shadow-black/40 transition focus-within:border-blue-400/50">
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 py-1.5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Sesli not dinleniyor...
              </p>
              <p className="text-xs font-mono text-zinc-400">
                {formatSeconds(recordingSeconds)} / 00:{MAX_VOICE_SECONDS}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
              <span>İptal</span>
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-blue-400"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Bitir & Gönder</span>
            </button>
          </div>
        </div>
      ) : uploadingVoice ? (
        <div className="flex items-center justify-center gap-2.5 py-2.5 text-sm text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Ses kaydı AI tarafından yazıya dökülüyor...</span>
        </div>
      ) : (
        <>
          <textarea
            ref={inputRef}
            autoFocus
            rows={2}
            maxLength={MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={`${activeProjectName} projesine not bırakın... (örn: "Semrush", "yarın bütçe sunumu" veya bir fikir)`}
            className="w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />

          <div className="mt-1 flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">
                Enter ile gönder • Ajan otomatik araştırır & sınıflandırır
              </span>
              <span className="font-mono text-zinc-500">
                {text.length}/{MAX_CHARS}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startRecording}
                title="Sesli Not (Maks. 45 sn)"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition hover:bg-zinc-700/60 hover:text-blue-300"
              >
                <Mic className="h-[18px] w-[18px]" />
              </button>

              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={!text.trim() || submittingText}
                title="Gönder"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-blue-300 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {submittingText ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
