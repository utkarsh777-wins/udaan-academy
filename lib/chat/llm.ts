import { academy, courseFeeSummary, type Language } from "@/lib/academy";

type Turn = { role: "user" | "assistant"; content: string };

const BASES: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  together: "https://api.together.xyz/v1",
};

export function claimsConfirmation(text: string): boolean {
  return /(?:^|[^a-z])(?:confirmed|reserved|booked)(?![a-z])|कन्फर्म|पक्क[ीा]|ਕਨਫਰਮ|ਪੱਕ[ੀਾ]/i.test(text);
}

export async function askCounsellor(options: {
  language: Language;
  history: Turn[];
  message: string;
}): Promise<string | null> {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();
  if (!provider || !apiKey || !model) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    if (provider === "anthropic") {
      return await anthropic(apiKey, model, options, controller.signal);
    }
    if (provider === "gemini" || provider === "google") {
      return await gemini(apiKey, model, options, controller.signal);
    }
    const base = process.env.LLM_BASE_URL?.trim() || BASES[provider] || (provider.startsWith("http") ? provider : "");
    if (!base) return null;
    return await openAICompatible(base.replace(/\/$/, ""), apiKey, model, options, controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function systemPrompt(language: Language): string {
  const facts = academy.courses
    .map(
      (course) =>
        `${course.name} (${course.slug}): ${course.duration}. ${courseFeeSummary(course)}. Eligibility: ${course.eligibility}. Batches: ${course.batches
          .map((batch) => `${batch.label} ${batch.days} ${batch.time}`)
          .join("; ")}.`,
    )
    .join("\n");
  const languageName = language === "hi" ? "Hindi" : language === "pa" ? "Punjabi" : "English";
  return [
    `You are the counsellor at ${academy.name}, a coaching centre on GT Road in Phagwara. The centre on this website is fictional.`,
    `Reply only in ${languageName}.`,
    "Hindi and Punjabi sentences must end with । (danda). In Hindi, talk the way a North Indian coaching centre does: एग्ज़ाम, बैच, फ़ीस, क्लास, मॉक टेस्ट, डाउट, सिलेबस. Do not use परीक्षा, शुल्क, or पंजीकरण. In Punjabi use ਬੈਚ, ਫੀਸ, and ਕਲਾਸ.",
    "Never say a booking, trial class, or seat is confirmed. You cannot confirm a booking. Ask for the missing details and let the site save the request.",
    "Never invent band scores, ranks, selection counts, or student reviews.",
    `The phone is exactly ${academy.phone}. The address is a placeholder and has no PIN code. Do not give a map pin.`,
    "If the question is not about these courses, say so and offer to help with a course.",
    "The site does not send email.",
    facts,
  ].join("\n");
}

async function openAICompatible(
  base: string,
  apiKey: string,
  model: string,
  options: { language: Language; history: Turn[]; message: string },
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt(options.language) },
        ...options.history.slice(-8),
        { role: "user", content: options.message },
      ],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  return text || null;
}

async function anthropic(
  apiKey: string,
  model: string,
  options: { language: Language; history: Turn[]; message: string },
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: systemPrompt(options.language),
      messages: [
        ...options.history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user", content: options.message },
      ],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { content?: { text?: string }[] };
  const text = payload.content?.map((block) => block.text ?? "").join("").trim();
  return text || null;
}

async function gemini(
  apiKey: string,
  model: string,
  options: { language: Language; history: Turn[]; message: string },
  signal: AbortSignal,
): Promise<string | null> {
  const contents = [
    ...options.history.slice(-8).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: options.message }] },
  ];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      signal,
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(options.language) }] },
        contents,
      }),
    },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return text || null;
}
