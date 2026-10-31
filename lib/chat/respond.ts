import {
  academy,
  batchLabel,
  formatInr,
  getCourse,
  type BatchId,
  type Course,
  type Language,
} from "@/lib/academy";
import { addISODays, formatLongDate, todayISO } from "@/lib/dates";
import { batchHasEnded, nextOpenDate, weekdayIndex } from "@/lib/schedule";
import hindiContent from "@/content/academy.hi.json";
import punjabiContent from "@/content/academy.pa.json";
import {
  classYear,
  explicitConfirmation,
  explicitName,
  explicitNameRejection,
  isBareWrong,
  mentionsBatchWord,
  readNameReply,
  isLoneWeakConfirm,
  fold,
  includesTerm,
  isBookingCommand,
  isDurationQuestion,
  isOnlineQuestion,
  isQuestionForm,
  isStaffQuestion,
  isTrialContentQuestion,
  isTrialInfoQuestion,
  parseUtterance,
  questionAboutTrialEligibility,
  type Intent,
  type ParseResult,
} from "@/lib/chat/parser";

export type Draft = {
  active?: boolean;
  confirming?: boolean;
  pendingName?: string;
  pendingTimeName?: string;
  nameConfirmed?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  course?: string;
  batch?: BatchId;
  date?: string;
};

export type CounselResult = {
  reply: string;
  draft: Draft;
  ready: boolean;
  intent: Intent;
};

export function openingGreeting(language: Language): string {
  return speak(language, academy.counsellor.greeting[language]);
}

export function counsel(options: {
  text: string;
  language: Language;
  draft?: Draft;
  now?: Date;
}): CounselResult {
  const language = options.language;
  const now = options.now ?? new Date();
  let incoming = options.draft ?? {};
  const parsed = parseUtterance(options.text, now);
  const renameTurn = Boolean(incoming.pendingName);

  if (isCancel(options.text) && hasStarted(incoming)) {
    return {
      reply: cancelledReply(language),
      draft: {},
      ready: false,
      intent: "book",
    };
  }

  if (incoming.pendingTimeName && !isSubstantiveQuestion(options.text)) {
    const pendingTimeName = incoming.pendingTimeName;
    if (isAffirmative(options.text) || explicitConfirmation(options.text)) {
      return resumeDraft(
        { ...incoming, name: pendingTimeName, nameConfirmed: true, pendingTimeName: undefined, active: true },
        language,
      );
    }
    if (startsWithNo(options.text)) {
      return {
        reply: askFor("name", language),
        draft: { ...incoming, pendingTimeName: undefined, name: undefined, nameConfirmed: undefined, active: true },
        ready: false,
        intent: "book",
      };
    }
    incoming = { ...incoming, pendingTimeName: undefined };
  }

  if (incoming.pendingName) {
    const pendingName = incoming.pendingName;
    if (startsWithNo(options.text)) {
      const rest = options.text.split(/[,，]/u).slice(1).join(" ").trim();
      const kept = { ...incoming, pendingName: undefined };
      if (rest && specifiesFieldChange(parseUtterance(rest, now))) {
        const follow = counsel({ text: rest, language, draft: kept, now });
        return {
          reply: follow.reply,
          draft: { ...follow.draft, name: incoming.name, pendingName: undefined },
          ready: false,
          intent: "book",
        };
      }
      return resumeDraft(kept, language);
    }
    if (isSubstantiveQuestion(options.text) || isOnlineQuestion(options.text)) {
      const body = spokenAnswer(parsed, options.text, language);
      const rename = renameQuestion(language, pendingName);
      const reply = specifiesFieldChange(parsed)
        ? `${body.replace(/\s*Shall I send this\? \(yes \/ no\)|\s*भेज दूँ\? \(हाँ \/ नहीं\)|\s*ਭੇਜ ਦਿਆਂ\? \(ਹਾਂ \/ ਨਹੀਂ\)/gu, "").trim()} ${rename}`.trim()
        : withOneQuestion(body, rename);
      return {
        reply,
        draft: { ...incoming, pendingName, active: true },
        ready: false,
        intent: "book",
      };
    }
    const pieces = options.text.split(/\band\b|[,，]/iu).map((part) => part.trim()).filter(Boolean);
    const yesPart = isRenameYes(options.text, pendingName) || pieces.some((part) => isRenameYes(part, pendingName));
    if (yesPart && specifiesFieldChange(parsed)) {
      incoming = { ...incoming, name: pendingName, pendingName: undefined };
    } else if (yesPart) {
      return resumeDraft({ ...incoming, name: pendingName, pendingName: undefined }, language);
    } else if (isRenameNo(options.text)) {
      return resumeDraft({ ...incoming, pendingName: undefined }, language);
    } else if (isRenameBypass(options.text, parsed, pendingName)) {
      const follow = counsel({ text: options.text, language, draft: { ...incoming, pendingName: undefined }, now });
      return {
        reply: renameQuestion(language, pendingName),
        draft: { ...follow.draft, name: incoming.name, pendingName, active: true, confirming: false },
        ready: false,
        intent: "book",
      };
    } else {
      return askRename(incoming, pendingName, language);
    }
  }

  if (hasStarted(incoming) && isBareWrong(options.text)) {
    return {
      reply: whichPartWrong(language),
      draft: { ...incoming, pendingName: undefined },
      ready: false,
      intent: "book",
    };
  }

  if (incoming.confirming && isLoneWeakConfirm(options.text)) {
    return resumeDraft({ ...incoming, pendingName: undefined }, language);
  }

  if (hasStarted(incoming) && explicitNameRejection(options.text)) {
    return {
      reply: correctNameAsk(language),
      draft: { ...incoming, name: undefined, confirming: false, active: true, pendingName: undefined },
      ready: false,
      intent: "book",
    };
  }

  if (hasStarted(incoming) && explicitConfirmation(options.text)) {
    if (renameTurn) return resumeDraft({ ...incoming, pendingName: undefined }, language);
    if (incoming.confirming) {
      return {
        reply: speak(language, holding(language)),
        draft: { ...incoming, confirming: false, active: true, pendingName: undefined },
        ready: true,
        intent: "book",
      };
    }
    return resumeDraft({ ...incoming, pendingName: undefined }, language);
  }

  const stated = explicitName(options.text);
  if (stated && incoming.name && fold(stated) !== fold(incoming.name)) {
    const info = isSubstantiveQuestion(options.text) ? spokenAnswer(parsed, options.text, language) : sideQuestion(options.text, parsed, language);
    return askRename(incoming, stated, language, info);
  }

  if (hasStarted(incoming) && isSubstantiveQuestion(options.text)) {
    const afterQuestion = options.text.split(/[?？]/u).slice(1).join(" ").trim();
    const afterParsed = afterQuestion ? parseUtterance(afterQuestion, now) : null;
    if (!afterParsed || !specifiesFieldChange(afterParsed)) {
      return answerBesideDraft(incoming, stated, parsed, options.text, language);
    }
  }

  if (hasStarted(incoming) && !isBookingCommand(options.text)) {
    const info = sideQuestion(options.text, parsed, language);
    if (info) return answerBesideDraft(incoming, stated, parsed, options.text, language, info);
  }

  if (
    (parsed.intent === "admission" || parsed.intent === "eligibility" || parsed.intent === "status") &&
    !incoming.confirming
  ) {
    const body =
      parsed.intent === "admission"
        ? admissionAnswer(parsed, language)
        : parsed.intent === "eligibility"
          ? questionAboutTrialEligibility(options.text) || isTrialInfoQuestion(options.text)
            ? trialFreeReply(language, options.text)
            : eligibilityAnswer(parsed, language)
          : statusAnswer(language);
    const paired = nameWithQuestion(options.text);
    const draft = paired ? { ...incoming, name: paired, active: true } : incoming;
    const pending = paired ? firstMissing(draft) : hasStarted(incoming) ? firstMissing(incoming) : null;
    return {
      reply: pending ? `${body} ${askFor(pending, language)}` : body,
      draft,
      ready: false,
      intent: parsed.intent,
    };
  }

  if (incoming.confirming && mentionsChange(options.text) && !explicitName(options.text) && !specifiesFieldChange(parsed)) {
    return {
      reply: academy.counsellor.changeField[language],
      draft: { ...incoming, active: true, confirming: false },
      ready: false,
      intent: "book",
    };
  }

  if (incoming.confirming && isHedged(options.text) && !specifiesFieldChange(parsed)) {
    return {
      reply: clearYesReply(language),
      draft: incoming,
      ready: false,
      intent: "book",
    };
  }

  if (incoming.confirming && (isAffirmative(options.text) || isReadyToSend(options.text))) {
    if (renameTurn) return resumeDraft({ ...incoming, pendingName: undefined }, language);
    return {
      reply: speak(language, holding(language)),
      draft: { ...incoming, confirming: false, active: true },
      ready: true,
      intent: "book",
    };
  }

  if (hasStarted(incoming) && !incoming.name && !isSubstantiveQuestion(options.text) && !isOnlineQuestion(options.text)) {
    const taken = readNameReply(options.text, now);
    const named: Draft = { ...incoming, active: true, confirming: false, pendingName: undefined };
    if (taken.phone) named.phone = taken.phone;
    if (taken.course) named.course = taken.course;
    if (taken.date) named.date = taken.date;
    if (taken.batch && (named.course ? isBatchOnCourse(named.course, taken.batch) : true)) named.batch = taken.batch;
    if (taken.timeName && taken.name) {
      return {
        reply: timeNameQuestion(language, taken.name),
        draft: { ...named, pendingTimeName: taken.name, name: undefined, nameConfirmed: false },
        ready: false,
        intent: "book",
      };
    }
    if (!taken.name) {
      return {
        reply: askFor("name", language),
        draft: named,
        ready: false,
        intent: "book",
      };
    }
    named.name = taken.name;
    named.nameConfirmed = true;
    return resumeDraft(named, language);
  }

  const base = incoming.confirming ? { ...incoming, confirming: false } : incoming;
  const labelledBatch = Boolean(mentionsBatchWord(options.text) && parsed.batch);
  const fillsBooking = Boolean(
    !isSubstantiveQuestion(options.text) &&
      parsed.name &&
      (labelledBatch ||
        [Boolean(parsed.phone), parsed.courses.length === 1, Boolean(parsed.batch), Boolean(parsed.date)].filter(Boolean).length >= 2),
  );
  const booking = parsed.intent === "book" || hasStarted(base) || incoming.confirming || fillsBooking;
  if (!booking) {
    const stated = nameWithQuestion(options.text);
    const keepName = Boolean(stated);
    const kept = keepName ? { ...incoming, name: stated ?? undefined, active: true } : incoming;
    const body = answer(parsed, options.text, language);
    const missing = keepName ? firstMissing(kept) : null;
    return {
      reply: missing ? `${body} ${askFor(missing, language)}` : body,
      draft: kept,
      ready: false,
      intent: isTrialContentQuestion(options.text) ? "eligibility" : parsed.intent,
    };
  }

  const merged = {
    ...mergeDraft(base, parsed, options.text, mayApplyBatch(options.text, base, Boolean(incoming.confirming))),
    active: true,
    confirming: false,
  };
  const namedField = namedSlot(options.text);
  if (namedField && sameSlots(base, merged) && (base[namedField] || incoming.confirming)) {
    const cleared: Draft = { ...merged, confirming: false, active: true };
    if (namedField === "name") cleared.name = undefined;
    if (namedField === "phone") cleared.phone = undefined;
    if (namedField === "course") cleared.course = undefined;
    if (namedField === "batch") cleared.batch = undefined;
    if (namedField === "date") cleared.date = undefined;
    return {
      reply: askFor(namedField, language),
      draft: cleared,
      ready: false,
      intent: "book",
    };
  }
  if (
    incoming.confirming &&
    parsed.batch &&
    parsed.batch === base.batch &&
    !parsed.phone &&
    !parsed.date &&
    parsed.courses.length === 0 &&
    !(parsed.name && fold(parsed.name) !== fold(base.name ?? ""))
  ) {
    return {
      reply: summaryReply({ ...base, confirming: true }, language),
      draft: { ...base, confirming: true, active: true },
      ready: false,
      intent: "book",
    };
  }
  if (incoming.confirming && sameSlots(base, merged)) {
    return {
      reply: academy.counsellor.changeField[language],
      draft: { ...base, active: true, confirming: false },
      ready: false,
      intent: "book",
    };
  }

  const draft = applyWeekday(merged, language, now);
  const missingField = firstMissing(draft.draft);
  if (!missingField) {
    return {
      reply: summaryReply(draft.draft, language),
      draft: { ...draft.draft, confirming: true, active: true },
      ready: false,
      intent: "book",
    };
  }

  const askedForDate = firstMissing(base) === "date";
  const movedField = Boolean(parsed.phone || parsed.batch || parsed.courses.length === 1);
  const dateMiss = askedForDate && !parsed.date && !movedField && options.text.trim() ? academy.counsellor.dateMiss[language] : null;

  const preface =
    parsed.intent === "fees"
      ? [answer(parsed, options.text, language)]
        : parsed.intent === "phone" && !parsed.phone
          ? [answer(parsed, options.text, language)]
          : [];

  const repeatAsk = draft.hint || dateMiss ? null : askFor(missingField, language);
  return {
    reply: [draft.hint, dateMiss, ...preface, repeatAsk].filter(Boolean).join(" "),
    draft: draft.draft,
    ready: false,
    intent: "book",
  };
}

function answer(parsed: ParseResult, text: string, language: Language): string {
  if (isTrialContentQuestion(text)) return trialContentReply(parsed, language);
  if (isStaffQuestion(text)) return facultyAnswer(parsed, language);
  if (isOnlineQuestion(text)) return trialOnlineReply(language);
  if (isDurationQuestion(text) && (includesTerm(text, "trial") || text.includes("ट्रायल") || text.includes("ਟਰਾਇਲ"))) {
    return trialLengthReply(language, parsed);
  }
  if (parsed.intent === "greeting") return openingGreeting(language);
  if (parsed.intent === "off_topic") return offTopic(language);
  if (parsed.intent === "phone") return phoneAnswer(language);
  if (parsed.partySize !== null && parsed.time === null && parsed.intent !== "fees") {
    return partyAnswer(parsed, language);
  }
  if (parsed.intent === "fees") return feesAnswer(parsed, language);
  if (parsed.intent === "eligibility") return eligibilityAnswer(parsed, language);
  if (parsed.intent === "batches") return batchAnswer(parsed, language);
  if (parsed.intent === "recommend") return recommendAnswer(parsed, language);
  if (mentionsSeniorClass(text)) return seniorClass(language);
  return unknown(language);
}

const YES = new Set([
  "yes",
  "yes please",
  "yeah",
  "yep",
  "ok",
  "okay",
  "हाँ",
  "हां",
  "हाँ जी",
  "हां जी",
  "जी हाँ",
  "जी हां",
  "ठीक",
  "ठीक है",
  "theek hai",
  "thik hai",
  "theek",
  "go ahead",
  "आगे बढ़ो",
  "आगे बढ़िए",
  "ਹਾਂ",
  "ਹਾਂ ਜੀ",
  "ਠੀਕ",
  "ਠੀਕ ਹੈ",
  "ਠੀਕ ਹੈ ਜੀ",
  "all correct",
  "exactly right",
  "sab sahi",
  "ji haan",
  "ji han",
  "haan ji",
]);

const CANCEL_PHRASES = [
  "cancel",
  "cancel it",
  "cancel this",
  "stop",
  "stop it",
  "rehne do",
  "रहने दो",
  "never mind",
  "nevermind",
  "forget it",
  "रद्द",
  "रद्द करो",
  "रद्द करें",
  "रद्द कर दो",
  "कैंसल",
  "कैंसल करो",
  "कैंसल कर दो",
  "कैंसिल",
  "कैंसिल कर दो",
  "छोड़ो",
  "छोड़ दो",
  "ਰੱਦ",
  "ਰੱਦ ਕਰੋ",
  "ਰੱਦ ਕਰ ਦਿਓ",
  "ਛੱਡੋ",
  "ਕੈਂਸਲ",
  "ਕੈਂਸਲ ਕਰੋ",
].map((phrase) => phrase.normalize("NFC").toLowerCase());

const CANCEL_TOKENS = new Set(
  ["cancel", "stop", "rehne", "रद्द", "कैंसल", "कैंसिल", "छोड़ो", "ਰੱਦ", "ਛੱਡੋ", "ਕੈਂਸਲ"].map((word) =>
    word.normalize("NFC").toLowerCase(),
  ),
);

const CANCEL_FILLERS = new Set(["please", "plz", "ji", "जी", "ਜੀ", "the", "my"].map((word) => word.normalize("NFC").toLowerCase()));

function matchesCancel(source: string): boolean {
  const helpers = new Set(
    ["karo", "kar", "do", "करो", "कर", "दो", "दीजिए", "ਕਰੋ", "ਕਰ", "ਦਿਓ"].map((word) => word.normalize("NFC").toLowerCase()),
  );
  const soft = new Set(["just", "ok", "okay", "actually"]);
  const raw = source.split(/\s+/).filter(Boolean);
  if (raw.length > 0 && raw.length <= 6 && CANCEL_PHRASES.includes(raw.join(" "))) return true;
  const withoutHelpers = raw.filter((word) => !helpers.has(word) && !CANCEL_FILLERS.has(word));
  const meaningful = withoutHelpers.some((word) => CANCEL_TOKENS.has(word))
    ? withoutHelpers.filter((word) => !soft.has(word))
    : withoutHelpers;
  if (meaningful.length === 0 || meaningful.length > 4) return false;
  if (CANCEL_PHRASES.includes(meaningful.join(" "))) return true;
  return meaningful.every((word) => CANCEL_TOKENS.has(word));
}

function clauseIsNegated(text: string): boolean {
  return ["don't", "dont", "do not", "no need", "not", "mat", "मत", "नहीं", "ਨਾ", "ਨਹੀਂ"].some((word) => includesTerm(text, word));
}

function clauseCancels(text: string): boolean {
  if (/[?？]/.test(text) || clauseIsNegated(text)) return false;
  const cleaned = text.normalize("NFC").replace(/[.!।]+/g, " ").replace(/[,，]+/g, " ").replace(/\s+/g, " ").trim();
  const folded = cleaned.toLowerCase();
  if (/^(?:what|is|which|why|how|when|where|who|can|kya|क्या|ਕੀ)\b/u.test(folded)) return false;
  const withoutBusStop = folded.replace(/\bbus stop\b/g, " ").replace(/\s+/g, " ").trim();
  const lead = withoutBusStop
    .replace(/^(?:please|i would like to|i want to|no|nahi|nahin)\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (includesTerm(lead, "nahi") || includesTerm(lead, "nahin")) return false;
  if (matchesCancel(lead)) return true;
  const stripped = lead
    .replace(/\b(?:it|this|the booking|my booking|booking|the trial|trial|the request|request)\b/g, " ")
    .replace(/बुकिंग|ਬੁਕਿੰਗ/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (matchesCancel(stripped)) return true;
  return confirmPlusCancel(folded);
}

function isCancel(text: string): boolean {
  if (/[?？]/.test(text)) return false;
  const cleaned = text.normalize("NFC").replace(/[.!।]+/g, " ").replace(/[,，]+/g, " ").replace(/\s+/g, " ").trim();
  const folded = cleaned.toLowerCase();
  if (/^(?:what|is|which|why|how|when|where|who|can|kya|क्या|ਕੀ)\b/u.test(folded)) return false;
  if (includesTerm(cleaned, "what") || includesTerm(cleaned, "which") || includesTerm(cleaned, "kya") || cleaned.includes("क्या") || cleaned.includes("ਕੀ")) {
    return false;
  }
  const clauses = text
    .normalize("NFC")
    .split(/[.?!।,，\n\r]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauses.length > 1 && clauses.some((clause) => clauseCancels(clause))) return true;
  return clauseCancels(text);
}

function squeezeToken(token: string): string {
  return token.replace(/([\p{L}\p{M}])\1+/gu, "$1");
}

function startsWithNo(text: string): boolean {
  const flat = text
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[,，.!?।]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phrases = ["do not change", "don't change", "dont change", "do not", "not needed", "mat badlo", "मत बदलो", "ਨਾ ਬਦਲੋ"];
  if (phrases.some((phrase) => flat === phrase || flat.startsWith(`${phrase} `))) return true;
  const first = flat.split(/\s+/u)[0] ?? "";
  const token = squeezeToken(first);
  const nos = new Set(
    ["no", "nope", "nah", "naah", "nko", "dont", "na", "naa", "nai", "nhi", "nahi", "nahin", "नहीं", "ना", "नही", "ਨਹੀਂ", "ਨਾ"].map(squeezeToken),
  );
  return nos.has(token) || nos.has(first);
}

function timeNameQuestion(language: Language, name: string): string {
  if (language === "hi") return `क्या आपका नाम ${name} है?`;
  if (language === "pa") return `ਕੀ ਤੁਹਾਡਾ ਨਾਮ ${name} ਹੈ?`;
  return `Is your name ${name}?`;
}

const RENAME_YES = new Set(
  [
    "correct",
    "right",
    "fine",
    "same",
    "ok",
    "okay",
    "sure",
    "yes",
    "yeah",
    "yep",
    "haan",
    "han",
    "ha",
    "ji haan",
    "ji han",
    "haan ji",
    "sahi",
    "sahi hai",
    "theek",
    "theek hai",
    "thik hai",
    "सही",
    "सही है",
    "हाँ",
    "हां",
    "हाँ जी",
    "हां जी",
    "जी हाँ",
    "जी हां",
    "ठीक",
    "ठीक है",
    "ਸਹੀ",
    "ਸਹੀ ਹੈ",
    "ਹਾਂ",
    "ਹਾਂ ਜੀ",
    "ਠੀਕ",
    "ਠੀਕ ਹੈ",
    "the name is correct",
    "my name is correct",
    "all correct",
    "exactly right",
    "looks good",
    "all good",
    "that is correct",
    "send",
    "sab sahi",
    "सब सही",
    "सब सही है",
    "yes please",
    "ok please",
    "okay please",
    "haan ji",
    "ਸਭ ਸਹੀ ਹੈ",
  ].map((phrase) => phrase.normalize("NFC").toLowerCase()),
);

function plainWords(text: string): string {
  return text.normalize("NFC").replace(/[।!?.,]+/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isRenameYes(text: string, pendingName: string): boolean {
  if (isHedged(text) || isCancel(text) || specifiesFieldChange(parseUtterance(text))) return false;
  const trimmed = plainWords(text);
  if (RENAME_YES.has(trimmed) || (isAffirmative(text) && !isReadyToSend(text))) return true;
  if (fold(trimmed) === fold(pendingName)) return true;
  const stated = explicitName(text);
  return Boolean(stated && fold(stated) === fold(pendingName));
}

function isRenameNo(text: string): boolean {
  const trimmed = plainWords(text);
  if (["no", "nope", "nah", "nahi", "nahin", "keep it", "the old one", "नहीं", "नही", "ਨਹੀਂ", "ਨਾ"].includes(trimmed)) return true;
  return /^(?:no|nah|nahi|nahin|नहीं|नही|ਨਹੀਂ|ਨਾ)\s+(?:thanks|thank you|please|ji|जी|ਜੀ)$/u.test(trimmed);
}

function isRenameBypass(text: string, parsed: ParseResult, pendingName: string): boolean {
  if (parsed.phone || parsed.batch || parsed.date || parsed.courses.length === 1) return true;
  if (!isSubstantiveQuestion(text) && !isOnlineQuestion(text)) return false;
  const stripped = text.normalize("NFC").replace(/[?？!।.]+/g, "").trim();
  return !isRenameYes(stripped, pendingName);
}

function whichPartWrong(language: Language): string {
  if (language === "hi") return "कौन सी बात गलत है?";
  if (language === "pa") return "ਕਿਹੜੀ ਗੱਲ ਗਲਤ ਹੈ?";
  return "Which part is wrong?";
}

function nameWithQuestion(text: string): string | null {
  const parts = text.split(/[.?!।]+/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const name = explicitName(text);
  if (!name) return null;
  const question = parts.some((part) => isQuestionForm(part) || isOnlineQuestion(part) || isTrialInfoQuestion(part));
  if (!question) return null;
  const asked = parts.slice(1).join(". ");
  const parsed = parseUtterance(asked);
  if (parsed.intent === "fees" || parsed.intent === "batches" || parsed.batch || parsed.courses.length > 0) return null;
  return name;
}

function confirmPlusCancel(folded: string): boolean {
  const words = folded.split(/\s+/).filter(Boolean);
  if (!words.some((word) => CANCEL_TOKENS.has(word))) return false;
  const soft = new Set(
    ["yes", "yeah", "ok", "okay", "correct", "right", "fine", "same", "all", "sahi", "theek", "sure", "and", "the", "is", "name", "my", "please", "ji", "सही", "हाँ", "ਹਾਂ", "ਠੀਕ", "ठीक"].map((word) =>
      word.normalize("NFC").toLowerCase(),
    ),
  );
  return words.every((word) => CANCEL_TOKENS.has(word) || soft.has(word));
}

function correctNameAsk(language: Language): string {
  if (language === "hi") return "सही नाम क्या है?";
  if (language === "pa") return "ਸਹੀ ਨਾਂ ਕੀ ਹੈ?";
  return "What is the correct name?";
}

function specifiesFieldChange(parsed: ParseResult): boolean {
  return Boolean(parsed.phone || parsed.batch || parsed.date || parsed.courses.length === 1);
}

function isReadyToSend(text: string): boolean {
  const trimmed = text.normalize("NFC").replace(/[।.!?]+$/g, "").replace(/\s+/g, " ").trim();
  return /^(?:i am|i'm|main) ready$/i.test(trimmed) || /^मैं तैयार(?: हूँ| हूं| हैं)?$/u.test(trimmed) || /^ਮੈਂ ਤਿਆਰ ਹਾਂ$/u.test(trimmed) || /^(?:ready|तैयार|ਤਿਆਰ)$/u.test(trimmed);
}

function sideQuestion(text: string, parsed: ParseResult, language: Language): string | null {
  if (isOnlineQuestion(text)) return trialOnlineReply(language);
  if (isDurationQuestion(text) && (includesTerm(text, "trial") || text.includes("ट्रायल") || text.includes("ਟਰਾਇਲ"))) {
    return trialLengthReply(language, parsed);
  }
  if (explicitName(text) && (parsed.intent === "fees" || parsed.intent === "batches" || parsed.intent === "phone" || isStaffQuestion(text))) {
    return answer(parsed, text, language);
  }
  return null;
}

function isSubstantiveQuestion(text: string): boolean {
  if (!isQuestionForm(text)) return false;
  const stripped = text.normalize("NFC").replace(/[?？!।.,]+/g, "").replace(/\s+/g, " ").trim();
  if (!stripped || isAffirmative(stripped) || isReadyToSend(stripped)) return false;
  if (/^(?:maybe|perhaps|probably|not sure|i think so|शायद|ਸ਼ਾਇਦ)$/iu.test(stripped)) return false;
  return true;
}

function spokenAnswer(parsed: ParseResult, text: string, language: Language): string {
  if (parsed.intent === "admission") return admissionAnswer(parsed, language);
  if (parsed.intent === "eligibility") {
    return questionAboutTrialEligibility(text) || isTrialInfoQuestion(text)
      ? trialFreeReply(language, text)
      : eligibilityAnswer(parsed, language);
  }
  if (parsed.intent === "status") return statusAnswer(language);
  return answer(parsed, text, language);
}

function answerBesideDraft(
  incoming: Draft,
  stated: string | null,
  parsed: ParseResult,
  text: string,
  language: Language,
  info?: string | null,
): CounselResult {
  const draft = stated && !incoming.name ? { ...incoming, name: stated } : incoming;
  const body = info || spokenAnswer(parsed, text, language);
  const missing = firstMissing(draft);
  const follow = incoming.confirming ? academy.counsellor.confirmAsk[language] : missing ? askFor(missing, language) : null;
  return {
    reply: [body, follow].filter(Boolean).join(" "),
    draft: { ...draft, active: true, confirming: Boolean(incoming.confirming), pendingName: undefined },
    ready: false,
    intent: "book",
  };
}

function renameQuestion(language: Language, name: string): string {
  if (language === "hi") return `नाम बदल कर '${name}' कर दूँ?`;
  if (language === "pa") return `ਨਾਮ ਬਦਲ ਕੇ '${name}' ਕਰ ਦਿਆਂ?`;
  return `Change the name to '${name}'?`;
}

function withOneQuestion(body: string, question: string): string {
  const cleaned = body
    .replace(/\s*Shall I send this\? \(yes \/ no\)|\s*भेज दूँ\? \(हाँ \/ नहीं\)|\s*ਭੇਜ ਦਿਆਂ\? \(ਹਾਂ \/ ਨਹੀਂ\)/gu, "")
    .trim();
  if (/\?/.test(cleaned)) return cleaned;
  return `${cleaned} ${question}`.trim();
}

function askRename(draft: Draft, name: string, language: Language, preface?: string | null): CounselResult {
  const question = renameQuestion(language, name);
  return {
    reply: preface ? withOneQuestion(preface, question) : question,
    draft: { ...draft, pendingName: name, active: true },
    ready: false,
    intent: "book",
  };
}

function resumeDraft(draft: Draft, language: Language): CounselResult {
  const next: Draft = { ...draft, pendingName: undefined };
  const missing = firstMissing(next);
  if (!missing) {
    return {
      reply: summaryReply(next, language),
      draft: { ...next, confirming: true, active: true },
      ready: false,
      intent: "book",
    };
  }
  return {
    reply: askFor(missing, language),
    draft: { ...next, confirming: false, active: true },
    ready: false,
    intent: "book",
  };
}

function isHedged(text: string): boolean {
  if (/[?？]/.test(text)) return true;
  const folded = text.normalize("NFC").toLowerCase();
  return ["maybe", "perhaps", "probably", "i think", "i guess", "not sure", "kinda", "sort of", "शायद", "ਸ਼ਾਇਦ", "lagta", "लगता"].some(
    (hedge) => folded.includes(hedge),
  );
}

function cancelledReply(language: Language): string {
  if (language === "hi") return speak("hi", ["ट्रायल का अनुरोध रोक दिया", "कुछ नहीं भेजा गया"]);
  if (language === "pa") return speak("pa", ["ਟਰਾਇਲ ਦੀ ਬੇਨਤੀ ਰੋਕ ਦਿੱਤੀ", "ਕੁਝ ਨਹੀਂ ਭੇਜਿਆ"]);
  return speak("en", ["I’ve stopped this trial request", "Nothing was sent"]);
}

function clearYesReply(language: Language): string {
  if (language === "hi") return speak("hi", ["भेजना हो तो साफ हाँ लिखिए"]);
  if (language === "pa") return speak("pa", ["ਭੇਜਣਾ ਹੋਵੇ ਤਾਂ ਸਾਫ਼ ਹਾਂ ਲਿਖੋ"]);
  return speak("en", ["Please say yes if I should send this"]);
}

function courseAllowsClass(course: Course, year: number): boolean {
  const text = course.eligibility.toLowerCase();
  if (/class\s+8\s+and\s+above/.test(text) && year >= 8 && year <= 12) return true;
  const years = [...text.matchAll(/\b(8|9|10|11|12)\b/g)].map((match) => Number(match[1]));
  return years.includes(year);
}

function batchHours(time: string): number | null {
  const range = parseClockRange(time);
  if (!range) return null;
  const start = range.start.hour % 12 + (range.start.meridiem === "pm" ? 12 : 0) + range.start.minute / 60;
  const end = range.end.hour % 12 + (range.end.meridiem === "pm" ? 12 : 0) + range.end.minute / 60;
  const hours = end - start;
  return hours > 0 ? hours : null;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(hours);
}

function trialLengthReply(language: Language, parsed: ParseResult): string {
  const courses = parsed.courses.length ? academy.courses.filter((course) => parsed.courses.includes(course.slug)) : academy.courses;
  const hours = courses.flatMap((course) => course.batches.map((batch) => batchHours(batch.time))).filter((value): value is number => value != null);
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const span = min === max ? formatHours(min) : `${formatHours(min)}–${formatHours(max)}`;
  if (language === "hi") {
    return speak("hi", ["ट्रायल एक फ्री क्लास है", `वह बैच ${span} घंटे चलता है`, "पूरा कोर्स नहीं"]);
  }
  if (language === "pa") {
    return speak("pa", ["ਟਰਾਇਲ ਇੱਕ ਫ੍ਰੀ ਕਲਾਸ ਹੈ", `ਉਹ ਬੈਚ ${span} ਘੰਟੇ ਚੱਲਦਾ ਹੈ`, "ਪੂਰਾ ਕੋਰਸ ਨਹੀਂ"]);
  }
  return speak("en", ["The trial is one free class", `It lasts as long as that batch, ${span} hours`, "It is not the full course"]);
}

function trialOnlineReply(language: Language): string {
  if (language === "hi") return speak("hi", ["ट्रायल क्लास जीटी रोड, फगवाड़ा की क्लास में होती है", "ऑनलाइन नहीं"]);
  if (language === "pa") return speak("pa", ["ਟਰਾਇਲ ਕਲਾਸ ਜੀਟੀ ਰੋਡ, ਫਗਵਾੜਾ ਦੀ ਕਲਾਸ ਵਿੱਚ ਹੁੰਦੀ ਹੈ", "ਔਨਲਾਈਨ ਨਹੀਂ"]);
  return speak("en", ["The trial class is in the classroom on GT Road in Phagwara", "It is not online"]);
}

function trialContentReply(parsed: ParseResult, language: Language): string {
  const courses = parsed.courses.length
    ? academy.courses.filter((course) => parsed.courses.includes(course.slug))
    : academy.courses;
  const paIncludes = punjabiContent.includes;
  const lines = courses.map((course) => {
    const hindi = hindiContent.courses[course.slug as keyof typeof hindiContent.courses];
    const punjabi = paIncludes[course.slug as keyof typeof paIncludes];
    const includes =
      language === "hi" && hindi?.includes?.length
        ? hindi.includes
        : language === "pa" && punjabi?.length
          ? punjabi
          : course.includes;
    return `${shownCourse(course, language)}: ${includes.join(", ")}`;
  });
  const list = lines.join("; ");
  if (language === "hi") {
    return speak("hi", ["ट्रायल उस बैच की एक फ्री क्लास है, पूरा कोर्स नहीं", `क्लास में ये होता है: ${list}`]);
  }
  if (language === "pa") {
    return speak("pa", ["ਟਰਾਇਲ ਉਸ ਬੈਚ ਦੀ ਇੱਕ ਫ੍ਰੀ ਕਲਾਸ ਹੈ, ਪੂਰਾ ਕੋਰਸ ਨਹੀਂ", `ਕਲਾਸ ਵਿੱਚ ਇਹ ਹੁੰਦਾ ਹੈ: ${list}`]);
  }
  return speak("en", ["A trial is one free class of that batch, not the full course", `The class covers ${list}`]);
}

function trialFreeReply(language: Language, text: string): string {
  const year = classYear(text);
  const courses = year ? academy.courses.filter((course) => courseAllowsClass(course, year)) : [];
  const rules = courses.map((course) => {
    const name = shownCourse(course, language);
    const rule = language === "hi" ? course.eligibilityHi : language === "pa" ? course.eligibilityPa : course.eligibility;
    return `${name}: ${rule}`;
  });
  const heading =
    language === "hi"
      ? year
        ? `क्लास ${year} के लिए ये कोर्स बैठते हैं`
        : "किस क्लास के लिए देखना है?"
      : language === "pa"
        ? year
          ? `ਕਲਾਸ ${year} ਲਈ ਇਹ ਕੋਰਸ ਬੈਠਦੇ ਹਨ`
          : "ਕਿਸ ਕਲਾਸ ਲਈ ਦੇਖਣਾ ਹੈ?"
        : year
          ? `For class ${year}, these courses fit`
          : "Which class should I check?";
  const free =
    language === "hi" ? "हाँ, ट्रायल क्लास फ्री है" : language === "pa" ? "ਹਾਂ, ਟਰਾਇਲ ਕਲਾਸ ਫ੍ਰੀ ਹੈ" : "Yes, the trial class is free";
  return speak(language, [free, heading, ...rules]);
}

function facultyAnswer(parsed: ParseResult, language: Language): string {
  const matched = academy.faculty.filter((person) => {
    if (parsed.courses.length === 0) return true;
    const role = person.role.toLowerCase();
    return parsed.courses.some((slug) => {
      if (slug === "ielts-pte") return role.includes("ielts");
      if (slug === "jee-foundation") return role.includes("jee");
      if (slug === "neet-foundation") return role.includes("neet");
      if (slug === "punjab-board") return role.includes("punjab");
      if (slug === "spoken-english") return role.includes("spoken");
      return false;
    });
  });
  const people = matched.length > 0 ? matched : academy.faculty;
  const lines = people.map((person) => {
    if (language === "hi") {
      const translated = hindiContent.faculty[person.id as keyof typeof hindiContent.faculty];
      return `${translated?.name ?? person.name}: ${translated?.role ?? person.role}`;
    }
    if (language === "pa") {
      const translated = punjabiContent.faculty[person.id as keyof typeof punjabiContent.faculty];
      return `${translated?.name ?? person.name}: ${translated?.role ?? person.role}`;
    }
    return `${person.name}: ${person.role}`;
  });
  const note =
    language === "hi"
      ? "ये नाम टीचरों की जगह खड़े हैं, फ़ोटो नहीं"
      : language === "pa"
        ? "ਇਹ ਨਾਮ ਅਧਿਆਪਕਾਂ ਦੀ ਥਾਂ ਖੜ੍ਹੇ ਹਨ, ਫੋਟੋ ਨਹੀਂ"
        : "These names stand in for the teachers. They are not photographs";
  return speak(language, [note, ...lines]);
}

function isAffirmative(text: string): boolean {
  const normalized = text
    .normalize("NFC")
    .replace(/[।!?.,]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const folded = normalized.toLowerCase();
  if (YES.has(folded) || YES.has(normalized)) return true;
  const starters = [
    "go ahead",
    "आगे बढ़ो",
    "आगे बढ़िए",
    "yes please",
    "yes send it",
    "yes send",
    "जी हाँ",
    "जी हां",
    "हाँ जी",
    "हां जी",
    "ਹਾਂ ਜੀ",
    "ठीक है",
    "ਠੀਕ ਹੈ",
    "yes",
    "yeah",
    "yep",
    "okay",
    "ok",
    "sure",
    "haan",
    "ha",
    "हाँ",
    "हां",
    "ਹਾਂ",
    "ठीक",
    "ਠੀਕ",
  ];
  const source = folded;
  const start = starters.find((item) => source === item || source.startsWith(`${item} `));
  if (!start) return false;
  const rest = source.slice(start.length).trim();
  if (!rest) return true;
  return /^(?:please|ji|जी|ਜੀ|send|send it|go ahead|भेज दो|भेज दीजिए|ਭੇਜ ਦਿਓ)(?:\s+(?:please|ji|जी|ਜੀ))?$/.test(rest);
}

const CHANGE_WORDS = [
  "change",
  "changing",
  "बदल",
  "बदलना",
  "बदलो",
  "बदलिए",
  "बदलें",
  "ਬਦਲ",
  "ਬਦਲਣਾ",
  "ਬਦਲੋ",
];

function mentionsChange(text: string): boolean {
  return CHANGE_WORDS.some((word) => includesTerm(text, word));
}

function namedSlot(text: string): "name" | "phone" | "course" | "batch" | "date" | null {
  const token = text.normalize("NFC").replace(/[।!?.,]+/g, "").trim().toLowerCase();
  const fields: Record<string, "name" | "phone" | "course" | "batch" | "date"> = {
    name: "name",
    naam: "name",
    नाम: "name",
    ਨਾਮ: "name",
    ਨਾਂ: "name",
    phone: "phone",
    फोन: "phone",
    फ़ोन: "phone",
    ਫੋਨ: "phone",
    ਫ਼ੋਨ: "phone",
    course: "course",
    कोर्स: "course",
    ਕੋਰਸ: "course",
    batch: "batch",
    बैच: "batch",
    ਬੈਚ: "batch",
    date: "date",
    तारीख: "date",
    ਤਾਰੀਖ: "date",
  };
  return fields[token] ?? null;
}

function sameSlots(left: Draft, right: Draft): boolean {
  return (
    left.name === right.name &&
    left.phone === right.phone &&
    left.course === right.course &&
    left.batch === right.batch &&
    left.date === right.date
  );
}

function shownCourse(course: Course, language: Language): string {
  if (language === "hi") {
    const translated = hindiContent.courses[course.slug as keyof typeof hindiContent.courses];
    return translated?.name ?? course.name;
  }
  if (language === "pa") return course.namePa;
  return course.name;
}

function windowHint(language: Language): string {
  if (language === "hi") return "तारीख आज से अगले 45 दिनों के अंदर लिखिए।";
  if (language === "pa") return "ਤਾਰੀਖ ਅੱਜ ਤੋਂ ਅਗਲੇ 45 ਦਿਨਾਂ ਦੇ ਅੰਦਰ ਲਿਖੋ।";
  return "Pick a date from today through the next 45 days.";
}

function runsTodayEnded(course: Course, date: string, now: Date): boolean {
  const running = course.batches.filter((batch) => batch.weekdays.includes(weekdayIndex(date)));
  return running.length > 0 && running.every((batch) => batchHasEnded(batch.time, date, now));
}

function nextLiveSlot(course: Course, from: string, latest: string, now: Date): { date: string; id: BatchId } | null {
  for (let offset = 1; offset <= 46; offset += 1) {
    const cursor = addISODays(from, offset);
    if (cursor > latest) return null;
    for (const batch of course.batches) {
      if (!batch.weekdays.includes(weekdayIndex(cursor))) continue;
      if (batchHasEnded(batch.time, cursor, now)) continue;
      return { date: cursor, id: batch.id as BatchId };
    }
  }
  return null;
}

function allFinishedHint(course: Course, language: Language, now: Date): string {
  const today = todayISO(now);
  const latest = addISODays(today, 45);
  const next = nextLiveSlot(course, today, latest, now);
  const name = shownCourse(course, language);
  const when = next ? formatLongDate(next.date, language) : "";
  const label = next ? batchLabel(next.id, language) : "";
  if (language === "hi") {
    return next
      ? `आज ${name} के सारे बैच खत्म हो चुके हैं। अगला ${label} बैच ${when} को है। वही ले लीजिए, या कोई और कोर्स चुनिए।`
      : `आज ${name} के सारे बैच खत्म हो चुके हैं। कोई और दिन या कोई और कोर्स चुनिए।`;
  }
  if (language === "pa") {
    return next
      ? `ਅੱਜ ${name} ਦੇ ਸਾਰੇ ਬੈਚ ਖਤਮ ਹੋ ਚੁੱਕੇ ਹਨ। ਅਗਲਾ ${label} ਬੈਚ ${when} ਨੂੰ ਹੈ। ਉਹ ਲੈ ਲਵੋ, ਜਾਂ ਕੋਈ ਹੋਰ ਕੋਰਸ ਚੁਣੋ।`
      : `ਅੱਜ ${name} ਦੇ ਸਾਰੇ ਬੈਚ ਖਤਮ ਹੋ ਚੁੱਕੇ ਹਨ। ਕੋਈ ਹੋਰ ਦਿਨ ਜਾਂ ਕੋਈ ਹੋਰ ਕੋਰਸ ਚੁਣੋ।`;
  }
  return next
    ? `Every ${name} batch has already finished today. The next one is the ${label} batch on ${when}. You can take that, or pick another course.`
    : `Every ${name} batch has already finished today. Pick another day, or another course.`;
}

function applyWeekday(draft: Draft, language: Language, now: Date): { draft: Draft; hint: string | null } {
  if (!draft.date || !draft.course) return { draft, hint: null };
  const today = todayISO(now);
  const latest = addISODays(today, 45);
  if (draft.date < today || draft.date > latest) {
    return { draft: { ...draft, date: undefined }, hint: windowHint(language) };
  }
  const course = getCourse(draft.course);
  if (!course) return { draft, hint: null };
  if (!draft.batch) {
    if (draft.date === today && runsTodayEnded(course, draft.date, now)) {
      return { draft: { ...draft, date: undefined }, hint: allFinishedHint(course, language, now) };
    }
    return { draft, hint: null };
  }
  const batch = course.batches.find((item) => item.id === draft.batch);
  if (batch && batchHasEnded(batch.time, draft.date, now)) {
    const hint =
      language === "hi"
        ? "आज का यह बैच खत्म हो चुका है। कोई और दिन चुनिए।"
        : language === "pa"
          ? "ਅੱਜ ਦਾ ਇਹ ਬੈਚ ਖਤਮ ਹੋ ਚੁੱਕਾ ਹੈ। ਕੋਈ ਹੋਰ ਦਿਨ ਚੁਣੋ।"
          : "That batch has already finished today. Pick another day.";
    return { draft: { ...draft, date: undefined }, hint };
  }
  if (!batch || batch.weekdays.includes(weekdayIndex(draft.date))) return { draft, hint: null };
  const next = nextOpenDate(draft.date, batch.weekdays, latest);
  const when = next ? formatLongDate(next, language) : "";
  const days = daysIn(language, batch.days);
  const label = batchLabel(draft.batch, language);
  const hint =
    language === "hi"
      ? `यह बैच उस दिन नहीं चलता। ${label} का बैच ${days} चलता है।${when ? ` अगली तारीख ${when} है।` : ""}`
      : language === "pa"
        ? `ਇਹ ਬੈਚ ਉਸ ਦਿਨ ਨਹੀਂ ਚੱਲਦਾ। ${label} ਦਾ ਬੈਚ ${days} ਚੱਲਦਾ ਹੈ।${when ? ` ਅਗਲੀ ਤਾਰੀਖ ${when} ਹੈ।` : ""}`
        : `That batch doesn't run on that day. ${batch.label} runs ${batch.days}.${when ? ` The next open day is ${when}.` : ""}`;
  return { draft: { ...draft, date: undefined }, hint };
}

function summaryReply(draft: Draft, language: Language): string {
  const course = getCourse(draft.course ?? "");
  const batch = course?.batches.find((item) => item.id === draft.batch);
  const phone = (draft.phone ?? "").replace(/(\d{5})(\d{5})/, "$1 $2");
  const when = draft.date ? formatLongDate(draft.date, language) : "";
  const timing = batch
    ? `${language === "en" ? batch.label : batchLabel(draft.batch as BatchId, language)} (${daysIn(language, batch.days)}, ${timeIn(language, batch.time)})`
    : "";
  const line = `${draft.name} · ${course ? shownCourse(course, language) : draft.course} · ${timing} · ${when} · ${phone}`;
  return [finish(language, line), academy.counsellor.confirmAsk[language]].join(" ");
}

function mayApplyBatch(text: string, draft: Draft, confirming: boolean): boolean {
  if (hasStarted(draft) && !draft.name) return false;
  if (hasStarted(draft) || confirming) return true;
  return mentionsBatchWord(text) || isBookingCommand(text);
}

function mergeDraft(draft: Draft, parsed: ParseResult, text: string, applyBatch: boolean): Draft {
  const next: Draft = { ...draft, confirming: false };
  const pending = firstMissing(next);
  if (parsed.nameExplicit && parsed.name && !next.name) next.name = parsed.name;
  else if (!next.name && parsed.name) next.name = parsed.name;
  else if (!next.name && pending === "name" && parsed.intent !== "book" && !mentionsBatchWord(text)) {
    const spoken = spokenName(text);
    if (spoken) next.name = spoken;
  }
  if (parsed.phone) next.phone = parsed.phone;
  if (parsed.courses.length === 1) next.course = parsed.courses[0];
  if (applyBatch && parsed.batch && isBatchOnCourse(next.course, parsed.batch)) next.batch = parsed.batch;
  else if (applyBatch && parsed.batch && !next.course) next.batch = parsed.batch;
  if (parsed.date) next.date = parsed.date;
  if (next.course && next.batch && !isBatchOnCourse(next.course, next.batch)) {
    next.batch = undefined;
  }
  return next;
}

function isBatchOnCourse(slug: string | undefined, batch: BatchId): boolean {
  if (!slug) return true;
  const course = getCourse(slug);
  return Boolean(course?.batches.some((item) => item.id === batch));
}

function hasStarted(draft: Draft): boolean {
  return Boolean(
    draft.active || draft.confirming || draft.name || draft.phone || draft.course || draft.batch || draft.date,
  );
}

function firstMissing(draft: Draft): "name" | "phone" | "course" | "batch" | "date" | null {
  if (!draft.name) return "name";
  if (!draft.phone) return "phone";
  if (!draft.course) return "course";
  if (!draft.batch) return "batch";
  if (!draft.date) return "date";
  return null;
}

function askFor(field: "name" | "phone" | "course" | "batch" | "date", language: Language): string {
  const line = academy.counsellor.ask[language][field] ?? academy.counsellor.ask.en.name;
  return language === "en" ? line : speak(language, [line]);
}

function holding(language: Language): string[] {
  if (language === "hi") {
    return ["डिटेल मिल गई", "मैं फ्री ट्रायल क्लास का अनुरोध अभी भेज रही हूँ", "बुकिंग मैं खुद कन्फर्म नहीं करूँगी, अगला जवाब सेंटर की तरफ से होगा"];
  }
  if (language === "pa") {
    return ["ਡਿਟੇਲ ਮਿਲ ਗਈ", "ਮੈਂ ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਦੀ ਬੇਨਤੀ ਹੁਣੇ ਭੇਜ ਰਹੀ ਹਾਂ", "ਬੁਕਿੰਗ ਮੈਂ ਖੁਦ ਕਨਫਰਮ ਨਹੀਂ ਕਰਾਂਗੀ, ਅਗਲਾ ਜਵਾਬ ਸੈਂਟਰ ਵੱਲੋਂ ਹੋਵੇਗਾ"];
  }
  return [
    "I have the details and I’m sending the free trial class request now",
    "I can’t confirm the booking myself — the next line will come from the centre’s record",
  ];
}

function offTopic(language: Language): string {
  return speak(language, academy.counsellor.offTopic[language]);
}

function phoneAnswer(language: Language): string {
  if (language === "hi") {
    return speak("hi", [
      `यहाँ लिखा फोन ${academy.phone} है`,
      "यह नंबर असली लाइन नहीं है",
      "फ्री ट्रायल क्लास के लिए अपना नंबर यहीं लिख दीजिए",
    ]);
  }
  if (language === "pa") {
    return speak("pa", [
      `ਇੱਥੇ ਲਿਖਿਆ ਫੋਨ ${academy.phone} ਹੈ`,
      "ਇਹ ਨੰਬਰ ਅਸਲੀ ਲਾਈਨ ਨਹੀਂ ਹੈ",
      "ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਲਈ ਆਪਣਾ ਨੰਬਰ ਇੱਥੇ ਲਿਖੋ",
    ]);
  }
  return speak("en", [
    `The phone listed here is ${academy.phone}`,
    academy.phoneNote,
    "For a free trial class, leave your own number here",
  ]);
}

function partyAnswer(parsed: ParseResult, language: Language): string {
  const count = parsed.partySize ?? 0;
  const batch = parsed.batch ? batchLabel(parsed.batch, language) : null;
  if (language === "hi") {
    return speak("hi", [
      `आप ${count} लोग हैं`,
      "यह समय नहीं, संख्या है",
      batch ? `${batch} का बैच भी नोट कर लिया` : "वीकेंड बैच में साथ बैठना आसान रहता है",
      "कौन सा कोर्स चाहिए?",
    ]);
  }
  if (language === "pa") {
    return speak("pa", [
      `ਤੁਸੀਂ ${count} ਲੋਕ ਹੋ`,
      "ਇਹ ਸਮਾਂ ਨਹੀਂ, ਗਿਣਤੀ ਹੈ",
      batch ? `${batch} ਦਾ ਬੈਚ ਵੀ ਨੋਟ ਕਰ ਲਿਆ` : "ਵੀਕਐਂਡ ਬੈਚ ਵਿੱਚ ਇਕੱਠੇ ਬੈਠਣਾ ਆਸਾਨ ਰਹਿੰਦਾ ਹੈ",
      "ਕਿਹੜਾ ਕੋਰਸ ਚਾਹੀਦਾ?",
    ]);
  }
  return speak("en", [
    `That’s ${count} people, not a time`,
    batch
      ? `I’ve noted the ${batch} batch as well`
      : "A weekend batch is the easier one if you want to sit together",
    "Which course is it for?",
  ]);
}

function feesAnswer(parsed: ParseResult, language: Language): string {
  const courses = selectedCourses(parsed);
  const lines = courses.map((course) => feeSentence(course, language));
  if (language === "hi") {
    return speak("hi", ["फीस अंदाज़े की है, डेस्क पर यही रेंज बताई जाती है", ...lines]);
  }
  if (language === "pa") {
    return speak("pa", ["ਫੀਸ ਅੰਦਾਜ਼ੇ ਦੀ ਹੈ, ਡੈਸਕ ਉੱਤੇ ਇਹੀ ਰੇਂਜ ਦੱਸੀ ਜਾਂਦੀ ਹੈ", ...lines]);
  }
  return speak("en", ["These are indicative fees, the range the desk would quote", ...lines]);
}

function eligibilityAnswer(parsed: ParseResult, language: Language): string {
  const courses = selectedCourses(parsed);
  if (courses.length === 0 || courses.length === academy.courses.length) {
    if (language === "hi") return "किस कोर्स की शर्त देखनी है?";
    if (language === "pa") return "ਕਿਸ ਕੋਰਸ ਦੀ ਸ਼ਰਤ ਦੇਖਣੀ ਹੈ?";
    return speak("en", ["Which course should I check eligibility for?"]);
  }
  const lines = courses.map((course) => {
    const name = shownCourse(course, language);
    const rule = language === "hi" ? course.eligibilityHi : language === "pa" ? course.eligibilityPa : course.eligibility;
    if (language === "hi") return `${name} के लिए: ${rule}`;
    if (language === "pa") return `${name} ਲਈ: ${rule}`;
    return `${name}: ${rule}`;
  });
  return speak(language, lines);
}

function batchAnswer(parsed: ParseResult, language: Language): string {
  const courses = parsed.courses.length
    ? selectedCourses(parsed).filter((course) => parsed.courses.includes(course.slug))
    : [];
  const night =
    parsed.period === "night"
      ? language === "hi"
        ? "रात का अलग बैच नहीं है, शाम वाला सबसे लेट है"
        : language === "pa"
          ? "ਰਾਤ ਦਾ ਵੱਖਰਾ ਬੈਚ ਨਹੀਂ ਹੈ, ਸ਼ਾਮ ਵਾਲਾ ਸਭ ਤੋਂ ਲੇਟ ਹੈ"
          : "There isn’t a separate night batch — the evening batch is the late one"
      : null;

  if (courses.length === 0) {
    const hint = parsed.batch
      ? language === "hi"
        ? `${batchLabel(parsed.batch, "hi")} का बैच हर कोर्स में है`
        : language === "pa"
          ? `${batchLabel(parsed.batch, "pa")} ਦਾ ਬੈਚ ਹਰ ਕੋਰਸ ਵਿੱਚ ਹੈ`
          : `The ${parsed.batch} batch runs for every course`
      : language === "hi"
        ? "सुबह, शाम और वीकेंड — तीन बैच हैं"
        : language === "pa"
          ? "ਸਵੇਰ, ਸ਼ਾਮ ਅਤੇ ਵੀਕਐਂਡ — ਤਿੰਨ ਬੈਚ ਹਨ"
          : "There is a morning batch, an evening batch, and a weekend batch";
    const ask =
      language === "hi"
        ? "किस कोर्स का टाइम चाहिए?"
        : language === "pa"
          ? "ਕਿਸ ਕੋਰਸ ਦਾ ਟਾਈਮ ਚਾਹੀਦਾ?"
          : "Which course do you want the times for?";
    return speak(language, [night, hint, ask].filter((line): line is string => Boolean(line)));
  }

  const lines = courses.map((course) => {
    const detail = batchSentence(course, language, parsed.batch ?? undefined);
    return `${shownCourse(course, language)}: ${detail}`;
  });
  return speak(language, [night, ...lines].filter((line): line is string => Boolean(line)));
}

function admissionAnswer(parsed: ParseResult, language: Language): string {
  const matched = parsed.courses.length
    ? academy.courses.filter((course) => parsed.courses.includes(course.slug))
    : [];
  const fees = (matched.length ? matched : []).map((course) => feeSentence(course, language));
  const overview = matched.length === 0 ? academy.counsellor.admissionOverview[language] : null;
  return speak(language, [
    academy.counsellor.admission[language],
    overview,
    ...fees,
    academy.counsellor.admissionOffer[language],
  ]);
}

function statusAnswer(language: Language): string {
  if (language === "hi") {
    return speak("hi", ["ट्रायल क्लास सेंटर फोन पर पक्की करता है", "यह चैट बुकिंग कन्फर्म नहीं करती"]);
  }
  if (language === "pa") {
    return speak("pa", ["ਟਰਾਇਲ ਕਲਾਸ ਸੈਂਟਰ ਫੋਨ ਉੱਤੇ ਪੱਕੀ ਕਰਦਾ ਹੈ", "ਇਹ ਚੈਟ ਬੁਕਿੰਗ ਕਨਫਰਮ ਨਹੀਂ ਕਰਦੀ"]);
  }
  return speak("en", [
    "The centre confirms a trial class by phone",
    "This chat cannot confirm a booking",
  ]);
}

function recommendAnswer(parsed: ParseResult, language: Language): string {
  const courses = selectedCourses(parsed).filter((course) =>
    parsed.courses.includes(course.slug),
  );
  if (courses.length === 0) return unknown(language);
  if (courses.length > 1) {
    const names = courses.map((course) => course.name).join(", ");
    return academy.counsellor.multiCourse[language].replace("{names}", names);
  }
  const course = courses[0];
  const extra = parsed.batch ? batchSentence(course, language, parsed.batch) : batchSentence(course, language);
  const trial =
    language === "hi"
      ? "फ्री ट्रायल क्लास बुक करनी हो तो कह दीजिए"
      : language === "pa"
        ? "ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਬੁੱਕ ਕਰਨੀ ਹੋਵੇ ਤਾਂ ਕਹਿ ਦਿਓ"
        : "Say if you want to book a free trial class";
  return speak(language, [course.pitch[language], feeSentence(course, language), extra, trial]);
}

function seniorClass(language: Language): string {
  if (language === "hi") {
    return speak("hi", [
      "क्लास 11 या 12 के लिए तीन रास्ते हैं",
      "मेडिकल हो तो NEET फाउंडेशन, इंजीनियरिंग हो तो JEE फाउंडेशन, स्कूल की परीक्षा हो तो पंजाब बोर्ड",
    ]);
  }
  if (language === "pa") {
    return speak("pa", [
      "ਕਲਾਸ 11 ਜਾਂ 12 ਲਈ ਤਿੰਨ ਰਾਹ ਹਨ",
      "ਮੈਡੀਕਲ ਹੋਵੇ ਤਾਂ NEET ਫਾਊਂਡੇਸ਼ਨ, ਇੰਜੀਨੀਅਰਿੰਗ ਹੋਵੇ ਤਾਂ JEE ਫਾਊਂਡੇਸ਼ਨ, ਸਕੂਲ ਦੀ ਪ੍ਰੀਖਿਆ ਹੋਵੇ ਤਾਂ ਪੰਜਾਬ ਬੋਰਡ",
    ]);
  }
  return speak("en", [
    "For class 11 or 12 there are three paths",
    "Medical goes to NEET Foundation, engineering goes to JEE Foundation, and the school exam goes to Punjab board tuition",
  ]);
}

function unknown(language: Language): string {
  return speak(language, academy.counsellor.unknown[language]);
}

function selectedCourses(parsed: ParseResult): Course[] {
  if (parsed.courses.length === 0) return academy.courses;
  return academy.courses.filter((course) => parsed.courses.includes(course.slug));
}

function durationIn(language: Language, duration: string): string {
  if (language === "hi") {
    return duration
      .replace("weeks", "हफ्ते")
      .replace("Academic year, billed monthly", "साल भर, फीस महीने की")
      .replace("3 months, billed monthly", "3 महीने, फीस महीने की");
  }
  if (language === "pa") {
    return duration
      .replace("weeks", "ਹਫ਼ਤੇ")
      .replace("Academic year, billed monthly", "ਸਾਲ ਭਰ, ਫੀਸ ਮਹੀਨੇ ਦੀ")
      .replace("3 months, billed monthly", "3 ਮਹੀਨੇ, ਫੀਸ ਮਹੀਨੇ ਦੀ");
  }
  return duration;
}

function feeSentence(course: Course, language: Language): string {
  const duration = durationIn(language, course.duration);
  return course.fees
    .map((fee) => {
      const low = formatInr(fee.min);
      const high = formatInr(fee.max);
      const name = shownCourse(course, language);
      const hindiFees = hindiContent.courses[course.slug as keyof typeof hindiContent.courses]?.fees as Record<string, string> | undefined;
      const label =
        language === "hi"
          ? hindiFees?.[fee.label] ?? fee.label
          : language === "pa"
            ? punjabiContent.fees[fee.label as keyof typeof punjabiContent.fees] ?? fee.label
            : fee.label;
      if (language === "hi") {
        return fee.period === "package"
          ? `${name} की फीस पूरे पैकेज की ${low} से ${high} है, कोर्स ${duration} का है`
          : `${name} (${label}) की फीस महीने की ${low} से ${high} है`;
      }
      if (language === "pa") {
        return fee.period === "package"
          ? `${name} ਦੀ ਫੀਸ ਪੂਰੇ ਪੈਕੇਜ ਦੀ ${low} ਤੋਂ ${high} ਹੈ, ਕੋਰਸ ${duration} ਦਾ ਹੈ`
          : `${name} (${label}) ਦੀ ਫੀਸ ਮਹੀਨੇ ਦੀ ${low} ਤੋਂ ${high} ਹੈ`;
      }
      return fee.period === "package"
        ? `${course.name} is ${low}–${high} for the full package, over ${course.duration}`
        : `${course.name} (${fee.label}) is ${low}–${high} a month`;
    })
    .join("; ");
}

function daysIn(language: Language, days: string): string {
  if (language === "hi") {
    return days
      .replace("Mon–Fri", "सोमवार से शुक्रवार")
      .replace("Mon–Sat", "सोमवार से शनिवार")
      .replace("Sat–Sun", "शनिवार और रविवार");
  }
  if (language === "pa") {
    return days
      .replace("Mon–Fri", "ਸੋਮਵਾਰ ਤੋਂ ਸ਼ੁੱਕਰਵਾਰ")
      .replace("Mon–Sat", "ਸੋਮਵਾਰ ਤੋਂ ਸ਼ਨੀਵਾਰ")
      .replace("Sat–Sun", "ਸ਼ਨੀਵਾਰ ਅਤੇ ਐਤਵਾਰ");
  }
  return days;
}

export function formatBatchTime(time: string, language: Language): string {
  return timeIn(language, time);
}

function timeIn(language: Language, time: string): string {
  const range = parseClockRange(time);
  if (!range) return time;
  if (language === "en") {
    const start = enPart(range.start);
    const end = enPart(range.end);
    if (start.period === end.period) return `${start.clock} to ${end.clock} in the ${start.period}`;
    return `${start.clock} in the ${start.period} to ${end.clock} in the ${end.period}`;
  }
  const start = clockPart(language, range.start);
  const end = clockPart(language, range.end);
  const startPeriod = start.slice(0, start.indexOf(" "));
  const endPeriod = end.slice(0, end.indexOf(" "));
  const endHour = end.slice(end.indexOf(" ") + 1);
  if (language === "hi") {
    return startPeriod === endPeriod ? `${start} से ${endHour} बजे` : `${start} से ${end} बजे`;
  }
  return startPeriod === endPeriod ? `${start} ਤੋਂ ${endHour} ਵਜੇ` : `${start} ਤੋਂ ${end} ਵਜੇ`;
}

function parseClockRange(time: string): {
  start: { hour: number; minute: number; meridiem: "am" | "pm" };
  end: { hour: number; minute: number; meridiem: "am" | "pm" };
} | null {
  const shared = time.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (shared) {
    const meridiem = shared[5].toLowerCase() as "am" | "pm";
    return {
      start: { hour: Number(shared[1]), minute: Number(shared[2]), meridiem },
      end: { hour: Number(shared[3]), minute: Number(shared[4]), meridiem },
    };
  }
  const split = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!split) return null;
  return {
    start: { hour: Number(split[1]), minute: Number(split[2]), meridiem: split[3].toLowerCase() as "am" | "pm" },
    end: { hour: Number(split[4]), minute: Number(split[5]), meridiem: split[6].toLowerCase() as "am" | "pm" },
  };
}

function enPart(part: { hour: number; minute: number; meridiem: "am" | "pm" }): { clock: string; period: string } {
  const hour24 = part.meridiem === "pm" && part.hour < 12 ? part.hour + 12 : part.meridiem === "am" && part.hour === 12 ? 0 : part.hour;
  const clock = `${part.hour}:${String(part.minute).padStart(2, "0")}`;
  const period = hour24 < 12 ? "morning" : hour24 < 17 ? "afternoon" : "evening";
  return { clock, period };
}

function clockPart(
  language: Language,
  part: { hour: number; minute: number; meridiem: "am" | "pm" },
): string {
  const hour24 = part.meridiem === "pm" && part.hour < 12 ? part.hour + 12 : part.meridiem === "am" && part.hour === 12 ? 0 : part.hour;
  const shown = part.minute === 0 ? String(part.hour) : `${part.hour}:${String(part.minute).padStart(2, "0")}`;
  const hindi = hour24 === 12 ? "दोपहर" : hour24 < 12 ? "सुबह" : hour24 < 16 ? "दोपहर" : "शाम";
  const punjabi = hour24 === 12 ? "ਦੁਪਹਿਰ" : hour24 < 12 ? "ਸਵੇਰੇ" : hour24 < 16 ? "ਦੁਪਹਿਰ" : "ਸ਼ਾਮ";
  return `${language === "pa" ? punjabi : hindi} ${shown}`;
}

function batchSentence(course: Course, language: Language, only?: BatchId): string {
  const batches = only ? course.batches.filter((batch) => batch.id === only) : course.batches;
  return batches
    .map((batch) => {
      const days = daysIn(language, batch.days);
      const time = timeIn(language, batch.time);
      if (language === "hi") {
        const name =
          batch.id === "morning" ? "सुबह का बैच" : batch.id === "evening" ? "शाम का बैच" : "वीकेंड बैच";
        return `${name} ${days}, ${time}`;
      }
      if (language === "pa") {
        const name =
          batch.id === "morning" ? "ਸਵੇਰ ਦਾ ਬੈਚ" : batch.id === "evening" ? "ਸ਼ਾਮ ਦਾ ਬੈਚ" : "ਵੀਕਐਂਡ ਬੈਚ";
        return `${name} ${days}, ${time}`;
      }
      return `${batch.label} batch ${days}, ${time}`;
    })
    .join("; ");
}

function mentionsSeniorClass(text: string): boolean {
  return (
    includesTerm(text, "class 11") ||
    includesTerm(text, "class 12") ||
    includesTerm(text, "11th") ||
    includesTerm(text, "12th") ||
    text.includes("क्लास 11") ||
    text.includes("क्लास 12") ||
    text.includes("कक्षा 11") ||
    text.includes("ਕਲਾਸ 11") ||
    text.includes("ਕਲਾਸ 12")
  );
}

function stripPunctuation(value: string): string {
  return value.normalize("NFC").trim().replace(/[।.!?]+$/u, "");
}

function spokenName(text: string): string | null {
  if (mentionsBatchWord(text)) return null;
  return readNameReply(stripPunctuation(text)).name;
}

export function speak(language: Language, sentences: Array<string | null | undefined | false>): string {
  return sentences
    .filter((sentence): sentence is string => Boolean(sentence))
    .map((sentence) => finish(language, sentence))
    .join(" ");
}

function finish(language: Language, sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return "";
  if (/[?]$/.test(trimmed)) return trimmed;
  if (language === "en") {
    if (/[.!]$/.test(trimmed)) return trimmed;
    return `${trimmed}.`;
  }
  const core = trimmed.replace(/[।.]+$/u, "");
  return `${core}।`;
}

export function savedBookingReply(
  language: Language,
  booking: { id: string; name: string; course: string; batch: BatchId; date: string },
): string {
  const course = getCourse(booking.course);
  const courseName = course ? shownCourse(course, language) : booking.course;
  const when = formatLongDate(booking.date, language);
  const batch = batchLabel(booking.batch, language);
  if (language === "hi") {
    return speak("hi", [
      "फ्री ट्रायल क्लास का अनुरोध दर्ज हो गया है",
      `रेफरेंस ${booking.id} है`,
      `${booking.name}, ${courseName}, ${batch} बैच, ${when}`,
      "यह साइट ईमेल नहीं भेजती, रेफरेंस संभाल कर रखिए",
    ]);
  }
  if (language === "pa") {
    return speak("pa", [
      "ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਦੀ ਬੇਨਤੀ ਦਰਜ ਹੋ ਗਈ ਹੈ",
      `ਰੈਫਰੈਂਸ ${booking.id} ਹੈ`,
      `${booking.name}, ${courseName}, ${batch} ਬੈਚ, ${when}`,
      "ਇਹ ਸਾਈਟ ਈਮੇਲ ਨਹੀਂ ਭੇਜਦੀ, ਰੈਫਰੈਂਸ ਸੰਭਾਲ ਕੇ ਰੱਖੋ",
    ]);
  }
  return speak("en", [
    "Your free trial class request is in",
    `Reference ${booking.id}`,
    `${booking.name}, ${courseName}, ${batch} batch, ${when}`,
    "This site does not send email — please keep the reference",
  ]);
}

export function bookingErrorReply(
  language: Language,
  error: "rate_limit" | "duplicate_phone" | "invalid" | "bad_json",
  detail?: string,
  fields?: string[],
  limit?: "phone" | "ip" | "site",
  dateReason?: "window" | "weekday" | "ended",
): string {
  if (error === "rate_limit") {
    if (limit === "phone") {
      if (language === "hi") return speak("hi", ["इस नंबर से बहुत कोशिशें हो गईं", "दस मिनट रुक कर फिर लिखिए"]);
      if (language === "pa") return speak("pa", ["ਇਸ ਨੰਬਰ ਤੋਂ ਬਹੁਤ ਕੋਸ਼ਿਸ਼ਾਂ ਹੋ ਗਈਆਂ", "ਦਸ ਮਿੰਟ ਰੁਕ ਕੇ ਫਿਰ ਲਿਖੋ"]);
      return speak("en", ["Too many attempts for this number", "Wait ten minutes and try again"]);
    }
    if (limit === "site") {
      if (language === "hi") return speak("hi", ["इस घंटे में बहुत अनुरोध आ चुके हैं", "थोड़ी देर बाद फिर लिखिए"]);
      if (language === "pa") return speak("pa", ["ਇਸ ਘੰਟੇ ਵਿੱਚ ਬਹੁਤ ਬੇਨਤੀਆਂ ਆ ਚੁੱਕੀਆਂ ਹਨ", "ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਲਿਖੋ"]);
      return speak("en", ["Too many trial requests this hour", "Try again later"]);
    }
    if (language === "hi") {
      return speak("hi", [
        "इस कनेक्शन से बहुत कोशिशें हो गईं",
        "दस मिनट रुक कर फ्री ट्रायल क्लास फिर से लिखिए",
      ]);
    }
    if (language === "pa") {
      return speak("pa", [
        "ਇਸ ਕਨੈਕਸ਼ਨ ਤੋਂ ਬਹੁਤ ਕੋਸ਼ਿਸ਼ਾਂ ਹੋ ਗਈਆਂ",
        "ਦਸ ਮਿੰਟ ਰੁਕ ਕੇ ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਫਿਰ ਲਿਖੋ",
      ]);
    }
    return speak("en", [
      "Too many attempts from this connection",
      "Wait ten minutes and send the free trial class again",
    ]);
  }
  if (error === "duplicate_phone") {
    if (language === "hi") {
      return speak("hi", [
        "इस फोन नंबर से आज पहले ही एक फ्री ट्रायल क्लास लिखी जा चुकी है",
        "एक नंबर पर एक दिन में एक ट्रायल",
      ]);
    }
    if (language === "pa") {
      return speak("pa", [
        "ਇਸ ਫੋਨ ਨੰਬਰ ਤੋਂ ਅੱਜ ਪਹਿਲਾਂ ਹੀ ਇੱਕ ਫ੍ਰੀ ਟਰਾਇਲ ਕਲਾਸ ਲਿਖੀ ਜਾ ਚੁੱਕੀ ਹੈ",
        "ਇੱਕ ਨੰਬਰ ਉੱਤੇ ਇੱਕ ਦਿਨ ਵਿੱਚ ਇੱਕ ਟਰਾਇਲ",
      ]);
    }
    return speak("en", [
      "This phone number already has a free trial class request today",
      "One trial per number per day",
    ]);
  }
  if (language === "hi" || language === "pa") {
    const parts = invalidParts(language, fields, dateReason);
    if (parts.length === 0) {
      return language === "hi"
        ? speak("hi", ["कुछ बात अधूरी है, नाम, फोन, कोर्स, बैच और तारीख फिर से देख लीजिए"])
        : speak("pa", ["ਕੁਝ ਗੱਲ ਅਧੂਰੀ ਹੈ, ਨਾਮ, ਫੋਨ, ਕੋਰਸ, ਬੈਚ ਅਤੇ ਤਾਰੀਖ ਦੁਬਾਰਾ ਦੇਖ ਲਵੋ"]);
    }
    if (parts.length === 1 && fields?.length === 1 && fields[0] === "date" && dateReason === "ended") return parts[0];
    if (parts.length === 1 && fields?.length === 1 && fields[0] === "date" && dateReason !== "weekday") return parts[0];
    return speak(language, parts);
  }
  return speak("en", [detail ?? "Something’s missing. Check the name, phone, course, batch, and date."]);
}

function invalidParts(language: "hi" | "pa", fields?: string[], dateReason?: "window" | "weekday" | "ended"): string[] {
  const parts: string[] = [];
  const hi = language === "hi";
  if (fields?.includes("name")) parts.push(hi ? "नाम लिखिए" : "ਨਾਮ ਲਿਖੋ");
  if (fields?.includes("phone")) {
    parts.push(hi ? "फोन दस अंक का होना चाहिए, 6, 7, 8 या 9 से शुरू" : "ਫੋਨ ਦਸ ਅੰਕਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ, 6, 7, 8 ਜਾਂ 9 ਤੋਂ ਸ਼ੁਰੂ");
  }
  if (fields?.includes("course") || fields?.includes("batch")) {
    parts.push(hi ? "कोर्स और बैच चुनिए" : "ਕੋਰਸ ਅਤੇ ਬੈਚ ਚੁਣੋ");
  }
  if (fields?.includes("date") && dateReason === "ended") {
    parts.push(hi ? "आज का यह बैच खत्म हो चुका है। कोई और दिन चुनिए।" : "ਅੱਜ ਦਾ ਇਹ ਬੈਚ ਖਤਮ ਹੋ ਚੁੱਕਾ ਹੈ। ਕੋਈ ਹੋਰ ਦਿਨ ਚੁਣੋ।");
  } else if (fields?.includes("date") && dateReason === "weekday") {
    parts.push(hi ? "यह तारीख इस बैच के दिन नहीं बैठती" : "ਇਹ ਤਾਰੀਖ ਇਸ ਬੈਚ ਦੇ ਦਿਨ ਨਹੀਂ ਬੈਠਦੀ");
    parts.push(hi ? "बैच वाले दिन की तारीख लिखिए" : "ਬੈਚ ਵਾਲੇ ਦਿਨ ਦੀ ਤਾਰੀਖ ਲਿਖੋ");
  } else if (fields?.includes("date")) {
    parts.push(windowHint(language));
  }
  return parts;
}

export function formServerMessage(
  language: Language,
  body: {
    message?: string;
    error?: string;
    fields?: string[];
    limit?: "phone" | "ip" | "site";
    dateReason?: "window" | "weekday" | "ended";
  },
): string {
  const error =
    body.error === "rate_limit" || body.error === "duplicate_phone" || body.error === "invalid" || body.error === "bad_json"
      ? body.error
      : "invalid";
  return bookingErrorReply(
    language,
    error,
    language === "en" ? body.message : undefined,
    body.fields,
    body.limit,
    body.dateReason,
  );
}

export function languageSwitched(language: Language): string {
  if (language === "hi") return speak("hi", ["अब मैं हिन्दी में बात करूँगी"]);
  if (language === "pa") return speak("pa", ["ਹੁਣ ਮੈਂ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਾਂਗੀ"]);
  return speak("en", ["I’ll continue in English"]);
}
