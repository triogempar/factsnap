import type { CheckInput, Evidence, StreamEvent } from "./types";

export type Sample = {
  id: string;
  label: string;
  blurb: string;
  input: CheckInput;
};

const TURNBACKHOAX: Evidence = {
  url: "https://turnbackhoax.id/articles/32726-salah-minyak-goreng-asri-produksi-leong-hup-terbuat-dari-minyak-babi-",
  title: "[SALAH] Minyak goreng ASRI produksi LEONG HUP terbuat dari minyak babi",
  snippet:
    "TurnBackHoax (MAFINDO) menilai narasi ini salah. Produk tersertifikasi halal oleh lembaga Halal Malaysia, dan produsen yang benar adalah Syarikat Asri Vegetable Oil Products Sdn Bhd.",
  publishedDate: "2020-02-14",
};

export const SAMPLES: Sample[] = [
  {
    id: "asri",
    label: "Pesan berantai",
    blurb: "Indonesian forward",
    input: {
      kind: "text",
      text: "SEBARKAN SEGERA!! Minyak goreng merek ASRI produksi Leong Hup terbuat dari minyak babi. Produsennya punya peternakan babi terbesar di Malaka. Info dari grup internal. Tolong viralkan ke semua saudara sebelum pesan ini dihapus!",
    },
  },
  {
    id: "5g",
    label: "5G hoax",
    blurb: "Classic scare",
    input: {
      kind: "text",
      text: "BREAKING: Scientists confirmed that 5G towers spread COVID-19. My cousin's friend at the hospital says they are deleting the evidence. Share this before it disappears!!",
    },
  },
  {
    id: "eiffel",
    label: "Known fact",
    blurb: "Should hold up",
    input: {
      kind: "text",
      text: "The Eiffel Tower was completed in 1889 as the entrance arch for the Paris World's Fair.",
    },
  },
  {
    id: "snopes",
    label: "Fact-check link",
    blurb: "Read a URL",
    input: {
      kind: "url",
      url: "https://www.snopes.com/fact-check/5g-tower-torn-down-china-covid/",
    },
  },
];

export const SAMPLE_REPLAY: StreamEvent[] = [
  { type: "status", step: "extract", message: "Extracting checkable claims…" },
  {
    type: "claims",
    language: "Indonesian",
    claims: [
      {
        id: "c1",
        text: "Minyak goreng merek ASRI produksi Leong Hup terbuat dari minyak babi.",
      },
      {
        id: "c2",
        text: "Produsen minyak goreng ASRI memiliki peternakan babi terbesar di Malaka.",
      },
    ],
    redFlags: [
      { code: "urgency", detail: "Meminta pesan diviralkan sebelum dihapus." },
      { code: "anonymous", detail: "Menyebut sumber hanya sebagai grup internal." },
    ],
  },
  { type: "searching", claimId: "c1", message: "Searching fact-checkers for claim 1…" },
  { type: "sources", claimId: "c1", sources: [TURNBACKHOAX] },
  { type: "status", step: "judge", message: "Judging claim 1…" },
  {
    type: "verdict",
    claim: {
      id: "c1",
      text: "Minyak goreng merek ASRI produksi Leong Hup terbuat dari minyak babi.",
      verdict: "False",
      explanation:
        "TurnBackHoax (MAFINDO) menilai klaim ini salah. Produk tersebut tersertifikasi halal oleh lembaga Halal Malaysia, dan nama produsen yang benar adalah Syarikat Asri Vegetable Oil Products Sdn Bhd.",
      cited: [TURNBACKHOAX],
      reviewed: [TURNBACKHOAX],
    },
  },
  { type: "searching", claimId: "c2", message: "Searching fact-checkers for claim 2…" },
  { type: "sources", claimId: "c2", sources: [TURNBACKHOAX] },
  { type: "status", step: "judge", message: "Judging claim 2…" },
  {
    type: "verdict",
    claim: {
      id: "c2",
      text: "Produsen minyak goreng ASRI memiliki peternakan babi terbesar di Malaka.",
      verdict: "False",
      explanation:
        "Artikel yang sama menunjukkan produsennya bukan peternakan babi Leong Hup. Perusahaan yang benar adalah Syarikat Asri Vegetable Oil Products Sdn Bhd.",
      cited: [TURNBACKHOAX],
      reviewed: [TURNBACKHOAX],
    },
  },
  { type: "status", step: "share", message: "Writing a reply you can paste…" },
  {
    type: "done",
    result: {
      language: "Indonesian",
      inputSummary: "SEBARKAN SEGERA!! Minyak goreng merek ASRI produksi Leong Hup terbuat dari minyak babi.",
      score: 0,
      redFlags: [
        { code: "urgency", detail: "Meminta pesan diviralkan sebelum dihapus." },
        { code: "anonymous", detail: "Menyebut sumber hanya sebagai grup internal." },
      ],
      claims: [
        {
          id: "c1",
          text: "Minyak goreng merek ASRI produksi Leong Hup terbuat dari minyak babi.",
          verdict: "False",
          explanation:
            "TurnBackHoax (MAFINDO) menilai klaim ini salah. Produk tersebut tersertifikasi halal oleh lembaga Halal Malaysia, dan nama produsen yang benar adalah Syarikat Asri Vegetable Oil Products Sdn Bhd.",
          cited: [TURNBACKHOAX],
          reviewed: [TURNBACKHOAX],
        },
        {
          id: "c2",
          text: "Produsen minyak goreng ASRI memiliki peternakan babi terbesar di Malaka.",
          verdict: "False",
          explanation:
            "Artikel yang sama menunjukkan produsennya bukan peternakan babi Leong Hup. Perusahaan yang benar adalah Syarikat Asri Vegetable Oil Products Sdn Bhd.",
          cited: [TURNBACKHOAX],
          reviewed: [TURNBACKHOAX],
        },
      ],
      shareText:
        "Sudah saya cek. Klaim minyak goreng ASRI terbuat dari minyak babi itu salah, begitu juga klaim produsennya punya peternakan babi terbesar di Malaka. Produknya tersertifikasi halal dan produsennya Syarikat Asri Vegetable Oil Products. Skor kredibilitas pesan ini 0/100, jangan diteruskan. Sumber: https://turnbackhoax.id/articles/32726-salah-minyak-goreng-asri-produksi-leong-hup-terbuat-dari-minyak-babi-",
    },
  },
];
