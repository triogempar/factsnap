"use client";

import { scoreLabel } from "@/lib/score";
import type { Evidence, RedFlag, Verdict } from "@/lib/types";
import type { CheckView, ClaimView } from "@/lib/view";

const FLAG_LABEL: Record<RedFlag["code"], string> = {
  clickbait: "Clickbait",
  emotional: "Emotional push",
  anonymous: "Anonymous source",
  urgency: "Pressure to forward",
};

function band(score: number): string {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  if (score >= 30) return "low";
  return "bad";
}

function SourceList({ title, sources }: { title: string; sources: Evidence[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources">
      <h4>{title}</h4>
      <ul>
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title}
            </a>
            {source.snippet ? <p>{source.snippet}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaimCard({ claim, index }: { claim: ClaimView; index: number }) {
  const citedIds = new Set(claim.cited.map((source) => source.url));
  const extra = claim.reviewed.filter((source) => !citedIds.has(source.url));
  return (
    <article className={`claim claim-${claim.phase}`}>
      <header>
        <span className="claim-index">Claim {index + 1}</span>
        {claim.verdict ? <VerdictStamp verdict={claim.verdict} /> : <span className="pending">{phaseLabel(claim.phase)}</span>}
      </header>
      <p className="claim-text">{claim.text}</p>
      {claim.explanation ? <p className="explanation">{claim.explanation}</p> : null}
      {claim.phase === "done" && claim.cited.length > 0 ? <SourceList title="Cited" sources={claim.cited} /> : null}
      {claim.phase === "done" && claim.cited.length === 0 ? (
        <SourceList title="Sources reviewed" sources={claim.reviewed} />
      ) : null}
      {claim.phase === "done" && extra.length > 0 ? <SourceList title="Also reviewed" sources={extra} /> : null}
      {claim.phase !== "done" ? <SourceList title="Sources found" sources={claim.reviewed} /> : null}
    </article>
  );
}

function phaseLabel(phase: ClaimView["phase"]): string {
  if (phase === "searching") return "Searching";
  if (phase === "judging") return "Judging";
  if (phase === "done") return "Done";
  return "Queued";
}

function VerdictStamp({ verdict }: { verdict: Verdict }) {
  return <span className={`stamp stamp-${verdict.toLowerCase()}`}>{verdict}</span>;
}

export function ResultPanel({
  view,
  onCopy,
  copied,
}: {
  view: CheckView;
  onCopy: () => void;
  copied: boolean;
}) {
  const showResults = view.claims.length > 0 || view.error || view.phase === "running";
  if (!showResults) return null;
  const score = view.score;

  return (
    <section className="results" aria-live="polite">
      {view.preview ? (
        <p className="preview-banner">Sample replay. This is a saved example, not a live check of the text above.</p>
      ) : null}
      <div className="results-top">
        <div>
          <p className="status">{view.status || "Working…"}</p>
          {view.language ? <p className="language">Answering in {view.language}</p> : null}
        </div>
        {typeof score === "number" ? (
          <div className="score-block">
            <div
              className={`dial dial-${band(score)}`}
              style={{ ["--p" as string]: `${score}%` }}
              role="img"
              aria-label={`Credibility score ${score} out of 100, ${scoreLabel(score)}`}
            >
              <div>
                <strong>{score}</strong>
              </div>
            </div>
            <p>{scoreLabel(score)}</p>
          </div>
        ) : null}
      </div>
      {typeof score === "number" ? <p className="score-note">0 is the weakest score. 100 is the strongest.</p> : null}

      {view.redFlags.length > 0 ? (
        <ul className="flags">
          {view.redFlags.map((flag) => (
            <li key={flag.code}>
              <strong>{FLAG_LABEL[flag.code]}</strong>
              <span>{flag.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="claim-list">
        {view.claims.map((claim, index) => (
          <ClaimCard key={claim.id} claim={claim} index={index} />
        ))}
      </div>

      {view.error ? <p className="form-error">{view.error}</p> : null}

      {view.shareText ? (
        <div className="share">
          <div className="share-head">
            <h3>Reply for the group</h3>
            <button type="button" className="copy" onClick={onCopy}>
              {copied ? "Copied" : "Copy reply"}
            </button>
          </div>
          <p>{view.shareText}</p>
        </div>
      ) : null}
    </section>
  );
}
