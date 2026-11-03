import { Checker } from "@/components/checker";

const STEPS = [
  {
    n: "01",
    title: "Read",
    body: "DeepSeek V4.1 Flash pulls out 2–4 specific claims. Screenshots go straight to the model — it reads the chat bubble itself.",
  },
  {
    n: "02",
    title: "Search",
    body: "Exa looks first at Snopes, PolitiFact, Reuters, AFP, Full Fact, TurnBackHoax, and CekFakta, then opens the search if those desks are quiet.",
  },
  {
    n: "03",
    title: "Judge",
    body: "The model may only use pages that search actually returned. You get a verdict, a score, the red flags, and a reply in the original language.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#check">
          <span className="mark" aria-hidden="true">
            FS
          </span>
          <span className="brand-name">FactSnap</span>
        </a>
        <p className="topbar-note">Any language in · the same language out</p>
      </header>

      <main>
        <div className="layout">
          <section className="hero">
            <p className="kicker">For the family group chat</p>
            <h1>Don&apos;t forward it. Check it first.</h1>
            <p className="lede">
              Misinformation moves fastest in WhatsApp threads. Paste a claim, a link, or a screenshot of the
              message. FactSnap comes back with evidence — and a reply you can paste into the group.
            </p>
            <figure className="wire">
              <figcaption>Forwarded many times</figcaption>
              <blockquote>
                SEBARKAN! Minyak goreng ASRI terbuat dari minyak babi. Viralkan sebelum dihapus.
              </blockquote>
              <p className="gloss">
                “Share this! ASRI cooking oil is made from pork fat. Viral it before it’s deleted.”
              </p>
              <span className="stamp stamp-idle">Unchecked</span>
            </figure>
          </section>
          <Checker />
        </div>

        <section className="method" aria-labelledby="how-title">
          <div className="method-head">
            <h2 id="how-title">How the check uses AI</h2>
            <p>The model does not get the last word until search has brought back pages it can point at.</p>
          </div>
          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="foot">
        <p>
          FactSnap is a hackathon demo, not a newsroom. Unverified means the sources we retrieved were not enough
          to call it.
        </p>
      </footer>
    </>
  );
}
