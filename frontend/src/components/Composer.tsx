import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const FIXED_TRANSCRIPT = "find jose in contact list and send him 480 euros for weaving workshop";
const AUTO_STOP_MS = 4500;
const TRANSCRIBE_MS = 1200;

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
  const tickRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const transcribeRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (transcribeRef.current) clearTimeout(transcribeRef.current);
    };
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [message, recording]);

  function startRecording() {
    if (disabled || recording) return;
    setRecording(true);
    setRecordingTime(0);
    tickRef.current = window.setInterval(() => {
      setRecordingTime((t) => t + 0.1);
    }, 100);
    autoStopRef.current = window.setTimeout(() => {
      stopRecording(false);
    }, AUTO_STOP_MS);
  }

  function stopRecording(cancel = false) {
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
    if (cancel) return;
    setTranscribing(true);
    transcribeRef.current = window.setTimeout(() => {
      setMessage(FIXED_TRANSCRIPT);
      setTranscribing(false);
      transcribeRef.current = null;
    }, TRANSCRIBE_MS);
  }

  if (recording) {
    return (
      <div className="composer">
        <div className="recorder">
          <span className="timer">{recordingTime.toFixed(1)}s</span>
          <div className="waves">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                style={{ animationDelay: `${(i * 0.05) % 1}s` }}
              />
            ))}
          </div>
        </div>
        <button
          className="mic-btn"
          onClick={() => stopRecording(true)}
          aria-label="Cancel"
        >
          <Icon name="x" size={16} />
        </button>
        <button
          className="send-btn"
          onClick={() => stopRecording(false)}
          aria-label="Send"
        >
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

  const hasText = message.trim().length > 0;

  return (
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
        >
          <Icon name="mic" size={18} />
        </button>
      )}
    </div>
  );
}
