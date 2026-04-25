import type { ReactNode } from "react";
import Icon from "./Icon";

export type StepStatus = "running" | "done" | "failed";

export interface TimelineStep {
  title: string;
  sub?: ReactNode;
  status: StepStatus;
  time?: string;
}

interface Props {
  steps: TimelineStep[];
  elapsed?: string;
  dim?: boolean;
}

export default function Timeline({ steps, elapsed, dim }: Props) {
  const running = steps.some((s) => s.status === "running");

  return (
    <>
      <div className="timeline-meta">
        {running ? (
          <span className="running">Working{elapsed ? ` · ${elapsed}` : ""}</span>
        ) : (
          <span>Done{elapsed ? ` · ${elapsed}` : ""}</span>
        )}
      </div>
      <div className={`timeline ${dim ? "dim" : ""}`}>
        {steps.map((s, i) => (
          <Step key={i} step={s} />
        ))}
      </div>
    </>
  );
}

function Step({ step }: { step: TimelineStep }) {
  const icon =
    step.status === "done" ? <Icon name="check" size={12} /> :
    step.status === "running" ? <Icon name="loader" size={12} /> :
    step.status === "failed" ? <Icon name="x" size={12} /> : null;
  return (
    <div className="step">
      <div className={`step-icon ${step.status}`}>{icon}</div>
      <div className="step-body">
        <div className="title">{step.title}</div>
        {step.sub && <div className="sub">{step.sub}</div>}
      </div>
      {step.time && <div className="step-time">{step.time}</div>}
    </div>
  );
}
