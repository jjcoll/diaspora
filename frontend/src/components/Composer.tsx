import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const TRANSCRIPTS = [
  "Pay Chidinma 1200 EUR for the Q2 backend retainer",
  "Send José 500 euros for October invoice",
  "Pay Diego 800 EUR for the design sprint",
];

interface Props {
  message: string;
  setMessage: (m: string) => void;
  onSubmit: (m: string) => void;
  disabled?: boolean;
}

export default function Composer({ message, setMessage, onSubmit, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  function startRecording(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    if (disabled) return;
    setRecording(true);
    setRecordingTime(0);
    tickRef.current = window.setInterval(() => {
      setRecordingTime((t) => t + 0.1);
    }, 100);
  }

  function stopRecording(cancel = false, e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const duration = recordingTime;
    setRecording(false);
    setRecordingTime(0);
    if (cancel || duration < 0.5) return;
    const t = TRANSCRIPTS[Math.floor(Math.random() * TRANSCRIPTS.length)];
    setMessage(t);
    setTimeout(() => onSubmit(t), 180);
  }

  if (recording) {
    return (
      <div className="composer">
        <div className="recorder">
          <span className="timer">{recordingTime.toFixed(1)}s</span>
          <div className="waves">
            {Array.from({ length: 22 }).map((_, i) => (
              <span
                key={i}
                style={{ animationDelay: `${(i * 0.07) % 1}s` }}
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

  const hasText = message.trim().length > 0;

  return (
    <div className="composer">
      <span className="sparkle"><Icon name="sparkle" size={15} /></span>
      <input
        className="composer-input"
        placeholder="Pay Chidinma 1200 EUR for Q2…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(message);
        }}
        disabled={disabled}
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
          onMouseDown={() => startRecording()}
          onMouseUp={() => stopRecording(false)}
          onMouseLeave={() => recording && stopRecording(true)}
          onTouchStart={(e) => startRecording(e)}
          onTouchEnd={(e) => stopRecording(false, e)}
          aria-label="Hold to record voice note"
        >
          <Icon name="mic" size={18} />
        </button>
      )}
    </div>
  );
}
