"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Drawing or typing a signature.
 *
 * Shared by the client signing page and by the firm signing its own documents,
 * so the two produce identical PNGs and behave the same way. It is controlled:
 * the parent owns the value and decides what to do with it.
 */

const WIDTH = 640;
const HEIGHT = 150;
const INK = "#1b2b4f";

export type SignatureValue = {
  dataUrl: string;
  method: "DRAWN" | "TYPED";
} | null;

function signatureFont() {
  if (typeof window === "undefined") return "cursive";
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-signature")
    .trim();
  return family ? `${family}, cursive` : "cursive";
}

export function SignaturePad({
  signerName,
  value,
  onChange,
  onFirstInput,
}: {
  signerName: string;
  value: SignatureValue;
  onChange: (value: SignatureValue) => void;
  /** Fired once, the first time anything is drawn or typed. */
  onFirstInput?: () => void;
}) {
  const [mode, setMode] = useState<"DRAWN" | "TYPED">("DRAWN");
  const [typedName, setTypedName] = useState(signerName);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const typedRender = useRef(0);
  const touched = useRef(false);

  function noteFirstInput() {
    if (touched.current) return;
    touched.current = true;
    onFirstInput?.();
  }

  function prepareCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * ratio)) {
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    }
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = INK;
    context.fillStyle = INK;
    return context;
  }

  useEffect(() => {
    if (mode === "DRAWN") prepareCanvas();
  }, [mode]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = prepareCanvas();
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const point = pointFrom(event);
    lastPoint.current = point;
    context.beginPath();
    context.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    context.fill();
    noteFirstInput();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context || !lastPoint.current) return;
    const point = pointFrom(event);
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  }

  function endStroke() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange({ dataUrl: canvas.toDataURL("image/png"), method: "DRAWN" });
    }
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    onChange(null);
  }

  // Rendering happens in the event that caused it rather than in an effect, so
  // there is no cascading render and no stale image between keystrokes.
  async function renderTyped(rawName: string) {
    const name = rawName.trim();
    if (!name) {
      onChange(null);
      return;
    }

    const attempt = ++typedRender.current;
    const font = signatureFont();
    try {
      await document.fonts.load(`60px ${font}`);
    } catch {
      // If the webfont is unavailable the fallback still renders.
    }
    if (attempt !== typedRender.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = INK;
    context.font = `60px ${font}`;
    context.textBaseline = "middle";
    context.fillText(name, 12, HEIGHT / 2);
    onChange({ dataUrl: canvas.toDataURL("image/png"), method: "TYPED" });
  }

  return (
    <>
      <input type="hidden" name="signature" value={value?.dataUrl ?? ""} />
      <input type="hidden" name="method" value={value?.method ?? "DRAWN"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-[17px] font-semibold">
          Add your signature
        </h2>
        <div
          role="tablist"
          className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-[3px]"
        >
          {(["DRAWN", "TYPED"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => {
                setMode(option);
                onChange(null);
                if (option === "TYPED") void renderTyped(typedName);
              }}
              className={cn(
                "cursor-pointer rounded-md px-3.5 py-1.5 font-medium",
                mode === option ? "bg-surface text-fg shadow-sm" : "text-muted",
              )}
            >
              {option === "DRAWN" ? "Draw" : "Type"}
            </button>
          ))}
        </div>
      </div>

      {mode === "DRAWN" ? (
        <div className="relative h-[180px] rounded-lg border border-dashed border-line-strong bg-paper">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
            aria-label="Signature pad. Draw with your finger or mouse, or switch to Type."
            className="size-full touch-none rounded-lg"
          />
          <span className="pointer-events-none absolute inset-x-6 bottom-[42px] border-t border-[#bcc6d4]" />
          <span className="pointer-events-none absolute bottom-4 left-6 text-xs text-[#5f6b7d]">
            Sign above the line
          </span>
          <button
            type="button"
            onClick={clearPad}
            className="absolute top-2.5 right-3.5 cursor-pointer font-medium text-accent underline underline-offset-[3px]"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Full name
            <input
              value={typedName}
              onChange={(event) => {
                setTypedName(event.target.value);
                void renderTyped(event.target.value);
                noteFirstInput();
              }}
              autoComplete="name"
              className="rounded-lg border border-line bg-surface px-2.5 py-2 font-normal focus:border-muted focus:outline-none"
            />
          </label>
          <div
            aria-hidden="true"
            className="flex min-h-[110px] items-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-paper px-6 text-[46px] whitespace-nowrap text-signature-ink"
            style={{ fontFamily: "var(--font-signature), cursive" }}
          >
            {typedName}
          </div>
        </>
      )}
    </>
  );
}
