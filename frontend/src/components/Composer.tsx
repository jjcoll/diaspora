import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { extractInvoice, transcribeAudio } from "../api";

const AUTO_STOP_MS = 15000;

interface Props {
  message: string;
  setMessage: (m: string) => void;
  onSubmit: (m: string) => void;
  disabled?: boolean;
}

export default function Composer({ message, setMessage, onSubmit, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [message, recording]);

  function pickMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "";
  }

  async function startRecording() {
    if (disabled || recording) return;
    setError(null);
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      tickRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 0.1);
      }, 100);
      autoStopRef.current = window.setTimeout(() => stopRecording(false), AUTO_STOP_MS);
    } catch (err) {
      setError("Mic permission denied");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function stopRecording(cancel: boolean) {
    cancelledRef.current = cancel;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    setRecording(false);
    setRecordingTime(0);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      handleStop();
    }
  }

  async function handleStop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (cancelledRef.current) {
      chunksRef.current = [];
      return;
    }
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) return;
    const mime = recorder?.mimeType || chunks[0].type || "audio/webm";
    const blob = new Blob(chunks, { type: mime });
    setTranscribing(true);
    try {
      const text = await transcribeAudio(blob);
      setMessage(text);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setError(`Transcribe failed: ${m}`);
    } finally {
      setTranscribing(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const { prefilled } = await extractInvoice(file);
      if (prefilled) {
        setMessage(prefilled);
      } else {
        setError("No fields extracted from document");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setError(`Document scan failed: ${m}`);
    } finally {
      setExtracting(false);
    }
  }

  if (recording) {
    return (
      <div className="composer">
        <div className="recorder">
          <span className="timer">{recordingTime.toFixed(1)}s</span>
          <div className="waves">
            {Array.from({ length: 48 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${(i * 0.05) % 1}s` }} />
            ))}
          </div>
        </div>
        <button className="mic-btn" onClick={() => stopRecording(true)} aria-label="Cancel">
          <Icon name="x" size={16} />
        </button>
        <button className="send-btn" onClick={() => stopRecording(false)} aria-label="Send">
          <Icon name="check" size={16} />
        </button>
      </div>
    );
  }

  if (transcribing) {
    return (
      <div className="composer transcribing">
        <Icon name="loader" size={16} />
        <span className="transcribing-label">Transcribing…</span>
      </div>
    );
  }

  if (extracting) {
    return (
      <div className="composer transcribing">
        <Icon name="loader" size={16} />
        <span className="transcribing-label">Reading invoice…</span>
      </div>
    );
  }

  const hasText = message.trim().length > 0;

  return (
    <div className="composer-wrap">
      {error && <div className="composer-error">{error}</div>}
      <div className="composer">
        <span className="sparkle"><Icon name="sparkle" size={15} /></span>
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder="Pay Chidinma 1200 EUR for Q2…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(message);
            }
          }}
          disabled={disabled}
          rows={1}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={handleFile}
        />
        <button
          className="mic-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach invoice"
          disabled={disabled}
          title="Attach invoice"
        >
          <Icon name="paperclip" size={16} />
        </button>
        {hasText ? (
          <button
            className="send-btn"
            onClick={() => onSubmit(message)}
            aria-label="Send"
            disabled={disabled}
          >
            <Icon name="arrow-right" size={16} />
          </button>
        ) : (
          <button
            className="mic-btn"
            onClick={startRecording}
            aria-label="Tap to record voice note"
            disabled={disabled}
          >
            <Icon name="mic" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
