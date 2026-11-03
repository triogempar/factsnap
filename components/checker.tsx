"use client";

import { useRef, useState } from "react";
import { LIMITS } from "@/lib/limits";
import { readNdjson } from "@/lib/ndjson";
import { SAMPLE_REPLAY, SAMPLES, type Sample } from "@/lib/samples";
import type { CheckInput, StreamEvent } from "@/lib/types";
import { applyEvent, emptyView, type CheckView } from "@/lib/view";
import { ResultPanel } from "@/components/result-panel";

type Mode = "text" | "url" | "image";

const MODES: { id: Mode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "url", label: "Link" },
  { id: "image", label: "Screenshot" },
];

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function fileToJpegDataUrl(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That image is over 12 MB. Choose a smaller screenshot.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 3_500_000 && quality > 0.5) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > LIMITS.maxImageDataUrlChars) {
    throw new Error("That screenshot is still too large after compression. Crop it and try again.");
  }
  return dataUrl;
}

export function Checker() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [view, setView] = useState<CheckView>(emptyView);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);

  function begin(): { controller: AbortController; runId: number } {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = runRef.current + 1;
    runRef.current = runId;
    setCopied(false);
    setFormError(null);
    return { controller, runId };
  }

  function applySample(sample: Sample) {
    setFormError(null);
    if (sample.input.kind === "text") {
      setMode("text");
      setText(sample.input.text);
      return;
    }
    if (sample.input.kind === "url") {
      setMode("url");
      setUrl(sample.input.url);
    }
  }

  async function playReplay() {
    const { controller, runId } = begin();
    let next: CheckView = { ...emptyView, phase: "running", preview: true, status: "Playing a sample result…" };
    setView(next);
    try {
      for (const event of SAMPLE_REPLAY) {
        await wait(420, controller.signal);
        if (runRef.current !== runId) return;
        next = applyEvent(next, event, true);
        setView(next);
      }
    } catch {
      if (runRef.current === runId && !controller.signal.aborted) {
        setView((current) => ({ ...current, phase: "error", error: "The sample replay stopped." }));
      }
    }
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    setFormError(null);
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
    } catch (error) {
      setImageDataUrl(null);
      setImageName("");
      setFormError(error instanceof Error ? error.message : "Could not read that image.");
    }
  }

  function buildInput(): CheckInput {
    if (mode === "text") {
      const value = text.trim();
      if (value.length < LIMITS.minTextChars) throw new Error("Paste a little more text so there is a claim to check.");
      return { kind: "text", text: value };
    }
    if (mode === "url") {
      const value = url.trim();
      if (!value) throw new Error("Paste a link to check.");
      return { kind: "url", url: value };
    }
    if (!imageDataUrl) throw new Error("Add a screenshot of the message.");
    const trimmed = note.trim();
    return trimmed ? { kind: "image", imageDataUrl, note: trimmed } : { kind: "image", imageDataUrl };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    let input: CheckInput;
    try {
      input = buildInput();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Check the form and try again.");
      return;
    }

    const { controller, runId } = begin();
    let next: CheckView = { ...emptyView, phase: "running", status: "Starting the check…" };
    setView(next);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (runRef.current !== runId) return;
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `The check failed (${response.status}).`);
      }
      await readNdjson(response, (streamEvent: StreamEvent) => {
        if (runRef.current !== runId) return;
        next = applyEvent(next, streamEvent, false);
        setView(next);
      });
      if (runRef.current !== runId) return;
      if (next.phase === "running") {
        setView({ ...next, phase: "error", error: "The check ended before a verdict came back." });
      }
    } catch (error) {
      if (controller.signal.aborted || runRef.current !== runId) return;
      const message = error instanceof Error ? error.message : "The check failed.";
      setView((current) => ({
        ...current,
        phase: current.claims.some((claim) => claim.verdict) ? "done" : "error",
        error: message,
        status: message,
      }));
    }
  }

  async function onCopy() {
    if (!view.shareText) return;
    try {
      await navigator.clipboard.writeText(view.shareText);
      setCopied(true);
    } catch {
      setFormError("Could not copy from this browser. Select the reply and copy it manually.");
    }
  }

  const busy = view.phase === "running";

  return (
    <section className="panel" id="check">
      <form onSubmit={onSubmit}>
        <div className="panel-head">
          <h2>New check</h2>
          <p>Text, a news link, or a screenshot of a forwarded message.</p>
        </div>

        <div className="modes" role="tablist" aria-label="Input type">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "mode is-on" : "mode"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "text" ? (
          <label className="field">
            <span>Claim or forwarded message</span>
            <textarea
              value={text}
              maxLength={LIMITS.maxTextChars}
              rows={7}
              placeholder="Paste the message, in any language."
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </label>
        ) : null}

        {mode === "url" ? (
          <label className="field">
            <span>Article or fact-check link</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
        ) : null}

        {mode === "image" ? (
          <div className="field">
            <span id="shot-label">Screenshot</span>
            <label className={imageDataUrl ? "drop has-file" : "drop"}>
              <input
                aria-labelledby="shot-label"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void onImage(file);
                }}
              />
              {imageDataUrl ? (
                <img src={imageDataUrl} alt="Screenshot selected for fact-checking" />
              ) : (
                <span>Drop a chat screenshot, or choose a file. It is resized before upload.</span>
              )}
            </label>
            {imageName ? <p className="file-name">{imageName}</p> : null}
            <label className="field note-field">
              <span>Optional note</span>
              <input
                value={note}
                maxLength={LIMITS.maxNoteChars}
                placeholder="Anything the screenshot leaves out"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="samples">
          <p>Try a sample</p>
          <div>
            {SAMPLES.map((sample) => (
              <button key={sample.id} type="button" className="chip" onClick={() => applySample(sample)}>
                <strong>{sample.label}</strong>
                <span>{sample.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {formError ? <p className="form-error">{formError}</p> : null}

        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy && !view.preview ? "Checking…" : "Check this"}
          </button>
          <button type="button" className="ghost" onClick={() => void playReplay()} disabled={busy}>
            Play sample result
          </button>
        </div>
        <p className="hint">A live check usually takes well under a minute. Each claim is searched, then judged.</p>
      </form>
      <ResultPanel view={view} onCopy={() => void onCopy()} copied={copied} />
    </section>
  );
}
