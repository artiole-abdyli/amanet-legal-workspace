"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { markStarted, submitSignature } from "@/app/actions/sign";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ClientState } from "@/components/client/shell";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";

type Step = "review" | "sign";

const SIGNATURE_WIDTH = 640;
const SIGNATURE_HEIGHT = 150;

function signatureFont() {
  if (typeof window === "undefined") return "cursive";
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-signature")
    .trim();
  return family ? `${family}, cursive` : "cursive";
}

export function SignFlow({
  token,
  signerName,
  signerEmail,
  documentName,
  matterReference,
  pdfUrl,
}: {
  token: string;
  signerName: string;
  signerEmail: string;
  documentName: string;
  matterReference: string;
  pdfUrl: string;
}) {
  const [step, setStep] = useState<Step>("review");
  const [mode, setMode] = useState<"DRAWN" | "TYPED">("DRAWN");
  const [typedName, setTypedName] = useState(signerName);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const typedRender = useRef(0);

  const [state, formAction, pending] = useActionState(
    async (_previous: Awaited<ReturnType<typeof submitSignature>> | null, formData: FormData) =>
      submitSignature(token, formData),
    null,
  );

  function noteStarted() {
    if (started) return;
    setStarted(true);
    startTransition(async () => {
      await markStarted(token);
    });
  }

  // --- Drawing -------------------------------------------------------------

  function setUpCanvas() {
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
    context.strokeStyle = "#1b2b4f";
    context.fillStyle = "#1b2b4f";
    return context;
  }

  useEffect(() => {
    if (step === "sign" && mode === "DRAWN") setUpCanvas();
  }, [step, mode]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = setUpCanvas();
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const point = pointFrom(event);
    lastPoint.current = point;
    context.beginPath();
    context.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    context.fill();
    noteStarted();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
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
    if (canvas) setDataUrl(canvas.toDataURL("image/png"));
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setDataUrl(null);
  }

  // --- Typed ---------------------------------------------------------------

  // Rendering happens in the event that caused it rather than in an effect, so
  // there is no cascading render and no stale image between keystrokes.
  async function renderTyped(rawName: string) {
    const name = rawName.trim();
    if (!name) {
      setDataUrl(null);
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
    canvas.width = SIGNATURE_WIDTH;
    canvas.height = SIGNATURE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#1b2b4f";
    context.font = `60px ${font}`;
    context.textBaseline = "middle";
    context.fillText(name, 12, SIGNATURE_HEIGHT / 2);
    setDataUrl(canvas.toDataURL("image/png"));
  }

  // --- Done ----------------------------------------------------------------

  if (state?.ok) {
    return (
      <ClientState
        tone="ok"
        icon="check"
        title={`Thank you, ${firstName(signerName)}. It is signed.`}
        extra={
          <dl className="mt-2 w-full max-w-[460px] rounded-card border border-line bg-bg px-4 py-3.5 text-left">
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Document</dt>
              <dd className="min-w-0 text-right">{documentName}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Matter</dt>
              <dd className="font-mono text-[13px]">{matterReference}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Copy sent to</dt>
              <dd className="min-w-0 text-right font-mono text-[13px] break-all">
                {signerEmail}
              </dd>
            </div>
          </dl>
        }
      >
        Harlow &amp; Vance has been notified. A signed copy with its certificate
        of completion has been emailed to you. You can close this page.
      </ClientState>
    );
  }

  const ready = Boolean(dataUrl) && consent;

  return (
    <>
      <ol className="flex gap-2" aria-label="Progress">
        {(["Review", "Sign", "Done"] as const).map((label, index) => {
          const current = step === "review" ? 0 : 1;
          return (
            <li
              key={label}
              className={cn(
                "flex flex-1 items-center gap-2 border-t-[3px] pt-2.5 text-[13px] font-medium",
                index < current && "border-accent text-accent",
                index === current && "border-accent text-fg",
                index > current && "border-line text-faint",
              )}
            >
              <span
                className={cn(
                  "grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] text-[11.5px]",
                  index === current
                    ? "border-accent bg-accent text-accent-fg"
                    : index < current
                      ? "border-transparent bg-accent-soft"
                      : "border-current",
                )}
              >
                {index < current ? "✓" : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === "review" ? (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-surface-2">
            <iframe
              src={pdfUrl}
              title={`${documentName}, preview`}
              className="h-[62vh] min-h-[420px] w-full"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            <a
              href={pdfUrl}
              download
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-medium hover:bg-surface-2"
            >
              <Icon name="download" />
              Download PDF
            </a>
            <Button variant="primary" size="lg" onClick={() => setStep("sign")}>
              Continue to sign
              <Icon name="arrow" />
            </Button>
          </div>
        </>
      ) : (
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="signature" value={dataUrl ?? ""} />
          <input type="hidden" name="method" value={mode} />

          <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans text-[17px] font-semibold">
                Add your signature
              </h2>
              <div
                role="tablist"
                className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-[3px]"
              >
                {(["DRAWN", "TYPED"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => {
                      setMode(value);
                      setDataUrl(null);
                      if (value === "TYPED") void renderTyped(typedName);
                    }}
                    className={cn(
                      "cursor-pointer rounded-md px-3.5 py-1.5 font-medium",
                      mode === value
                        ? "bg-surface text-fg shadow-sm"
                        : "text-muted",
                    )}
                  >
                    {value === "DRAWN" ? "Draw" : "Type"}
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
                <span className="pointer-events-none absolute inset-x-6 bottom-[42px] border-t border-[#b8bdb9]" />
                <span className="pointer-events-none absolute bottom-4 left-6 text-xs text-[#6b716d]">
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
                  Your full name
                  <input
                    value={typedName}
                    onChange={(event) => {
                      setTypedName(event.target.value);
                      void renderTyped(event.target.value);
                      noteStarted();
                    }}
                    autoComplete="name"
                    className="rounded-lg border border-line bg-surface px-2.5 py-2 font-normal focus:border-accent focus:outline-none"
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

            <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]"
              />
              <span>
                I agree to sign this document electronically. I understand my
                electronic signature has the same effect as signing by hand.
              </span>
            </label>
          </section>

          {state && !state.ok ? (
            <p role="alert" className="font-medium text-danger">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button type="button" onClick={() => setStep("review")}>
              Back to document
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!ready || pending}
            >
              <Icon name="pen" />
              {pending ? "Signing…" : "Sign document"}
            </Button>
          </div>

          {!ready ? (
            <p aria-live="polite" className="text-right text-[12.5px] text-muted">
              {!dataUrl
                ? mode === "DRAWN"
                  ? "Draw your signature in the box to continue."
                  : "Type your name to continue."
                : "Tick the box to confirm you agree to sign electronically."}
            </p>
          ) : null}
        </form>
      )}
    </>
  );
}
