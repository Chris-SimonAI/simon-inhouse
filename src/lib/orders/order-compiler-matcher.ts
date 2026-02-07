const stopWords = new Set([
  'a',
  'an',
  'the',
  'please',
  'for',
  'me',
  'with',
  'without',
  'and',
  'or',
  'to',
  'of',
  'from',
  'i',
  'want',
  'would',
  'like',
  'can',
  'get',
  'order',
  'add',
]);

const quantityPrefixPattern = /^\s*(\d+)\s*(?:x\b)?\s*/i;
const saladEntreeCueTokens = new Set([
  'caesar',
  'garden',
  'greek',
  'cobb',
  'romaine',
  'arugula',
  'kale',
  'chopped',
  'vinaigrette',
]);
const saladSpreadCueTokens = new Set([
  'olive',
  'chicken',
  'tuna',
  'egg',
  'macaroni',
  'potato',
  'pimento',
]);

export interface ParsedOrderRequestLine {
  raw: string;
  normalized: string;
  quantity: number;
  tokens: string[];
}

export interface CandidateScore {
  score: number;
  exactNameMatch: boolean;
  phraseMatch: boolean;
  tokenHitsInName: number;
  tokenHitsInDescription: number;
  semanticAdjustment: number;
}

export interface RestaurantCoverageCandidate {
  restaurantGuid: string;
  score: number;
}

export function parseOrderRequestLines(message: string): ParsedOrderRequestLine[] {
  const compact = message
    .replace(/\s+/g, ' ')
    .replace(/\bthen\b/gi, ',')
    .replace(/\bplus\b/gi, ',')
    .trim();

  const segments = compact
    .split(/[,;\n]+/g)
    .flatMap((segment) => splitSegmentByAnd(segment))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const sourceSegments = segments.length > 0 ? segments : [message.trim()];

  return sourceSegments
    .map(parseSingleRequestLine)
    .filter((line) => line.normalized.length > 0);
}

export function scoreMenuCandidate(
  requestLine: ParsedOrderRequestLine,
  menuItemName: string,
  menuItemDescription: string | null,
): CandidateScore {
  const normalizedName = normalizeText(menuItemName);
  const normalizedDescription = normalizeText(menuItemDescription === null ? '' : menuItemDescription);
  const nameTokens = new Set(tokenize(normalizedName));
  const descriptionTokens = new Set(tokenize(normalizedDescription));

  const exactNameMatch = requestLine.normalized === normalizedName;
  const phraseMatch =
    normalizedName.includes(requestLine.normalized) ||
    requestLine.normalized.includes(normalizedName);

  let tokenHitsInName = 0;
  let tokenHitsInDescription = 0;

  for (const token of requestLine.tokens) {
    if (nameTokens.has(token)) {
      tokenHitsInName += 1;
      continue;
    }

    if (descriptionTokens.has(token)) {
      tokenHitsInDescription += 1;
    }
  }

  const semanticAdjustment = getSemanticAdjustment(
    requestLine,
    normalizedName,
    normalizedDescription,
  );

  const score = calculateScore({
    exactNameMatch,
    phraseMatch,
    tokenHitsInName,
    tokenHitsInDescription,
    requestedTokenCount: requestLine.tokens.length,
    semanticAdjustment,
  });

  return {
    score,
    exactNameMatch,
    phraseMatch,
    tokenHitsInName,
    tokenHitsInDescription,
    semanticAdjustment,
  };
}

export function chooseBestRestaurantGuid(
  requestCoverage: RestaurantCoverageCandidate[][],
): string | null {
  const aggregate = new Map<
    string,
    { score: number; coveredRequests: number }
  >();

  for (const candidatesForRequest of requestCoverage) {
    const seenForRequest = new Set<string>();
    for (const candidate of candidatesForRequest) {
      const current = aggregate.get(candidate.restaurantGuid) ?? {
        score: 0,
        coveredRequests: 0,
      };
      current.score += candidate.score;
      if (!seenForRequest.has(candidate.restaurantGuid)) {
        current.coveredRequests += 1;
        seenForRequest.add(candidate.restaurantGuid);
      }
      aggregate.set(candidate.restaurantGuid, current);
    }
  }

  const sorted = Array.from(aggregate.entries()).sort((a, b) => {
    if (b[1].coveredRequests !== a[1].coveredRequests) {
      return b[1].coveredRequests - a[1].coveredRequests;
    }

    if (b[1].score !== a[1].score) {
      return b[1].score - a[1].score;
    }

    return a[0].localeCompare(b[0]);
  });

  return sorted[0]?.[0] ?? null;
}

export function toMatchReason(score: CandidateScore): string {
  if (score.semanticAdjustment >= 12) {
    return 'Intent-aligned match';
  }

  if (score.semanticAdjustment <= -12) {
    return 'Lexical match (de-prioritized by intent)';
  }

  if (score.exactNameMatch) {
    return 'Exact item-name match';
  }

  if (score.phraseMatch) {
    return 'Name phrase match';
  }

  if (score.tokenHitsInName > 0 && score.tokenHitsInDescription > 0) {
    return `Token overlap (name ${score.tokenHitsInName}, description ${score.tokenHitsInDescription})`;
  }

  if (score.tokenHitsInName > 0) {
    return `Token overlap in name (${score.tokenHitsInName})`;
  }

  if (score.tokenHitsInDescription > 0) {
    return `Token overlap in description (${score.tokenHitsInDescription})`;
  }

  return 'Weak lexical similarity';
}

function parseSingleRequestLine(rawSegment: string): ParsedOrderRequestLine {
  const cleaned = rawSegment.trim();
  const withoutLeadingPhrases = cleaned
    .replace(/\b(i\s*want|i\s*would\s*like|can\s*i\s*get|let\s*me\s*get)\b/gi, '')
    .trim();
  const quantityMatch = withoutLeadingPhrases.match(quantityPrefixPattern);
  const quantity = quantityMatch ? Number.parseInt(quantityMatch[1], 10) : 1;

  const withoutQuantity = withoutLeadingPhrases.replace(quantityPrefixPattern, '');
  const withoutLeadingArticles = withoutQuantity
    .replace(/^(a|an|the)\s+/i, '')
    .trim();

  const normalized = normalizeText(withoutLeadingArticles);
  const tokens = tokenize(normalized);

  return {
    raw: cleaned,
    normalized,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    tokens,
  };
}

function splitSegmentByAnd(segment: string): string[] {
  const normalized = segment.trim();
  if (!/\band\b/i.test(normalized)) {
    return [normalized];
  }

  const splits = normalized
    .split(/\band\b/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (splits.length <= 1) {
    return [normalized];
  }

  return splits;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !stopWords.has(token));
}

function calculateScore(input: {
  exactNameMatch: boolean;
  phraseMatch: boolean;
  tokenHitsInName: number;
  tokenHitsInDescription: number;
  requestedTokenCount: number;
  semanticAdjustment: number;
}): number {
  let score = 0;

  if (input.exactNameMatch) {
    score += 120;
  }

  if (input.phraseMatch) {
    score += 60;
  }

  score += input.tokenHitsInName * 18;
  score += input.tokenHitsInDescription * 7;

  if (input.requestedTokenCount > 0) {
    const matchedTokenCount = input.tokenHitsInName + input.tokenHitsInDescription;
    const coverage = matchedTokenCount / input.requestedTokenCount;
    score += Math.round(coverage * 20);
  }

  score += input.semanticAdjustment;

  return score;
}

function getSemanticAdjustment(
  requestLine: ParsedOrderRequestLine,
  normalizedName: string,
  normalizedDescription: string,
): number {
  const requestTokens = new Set(requestLine.tokens);
  const nameTokens = new Set(tokenize(normalizedName));
  const descriptionTokens = new Set(tokenize(normalizedDescription));

  const isGenericSaladRequest =
    requestTokens.has('salad') && requestTokens.size === 1;
  if (!isGenericSaladRequest) {
    return 0;
  }

  const hasEntreeSaladCues =
    hasAnyToken(nameTokens, saladEntreeCueTokens) ||
    hasAnyToken(descriptionTokens, saladEntreeCueTokens);
  const hasSpreadCues =
    hasAnyToken(nameTokens, saladSpreadCueTokens) ||
    hasAnyToken(descriptionTokens, saladSpreadCueTokens) ||
    /\b\d+\s*oz\b/.test(normalizedName);

  let adjustment = 0;

  if (hasEntreeSaladCues) {
    adjustment += 16;
  }

  if (hasSpreadCues) {
    adjustment -= 22;
  }

  if (
    adjustment === 0 &&
    normalizedName.includes('salad') &&
    !hasSpreadCues
  ) {
    adjustment += 6;
  }

  return adjustment;
}

function hasAnyToken(tokens: Set<string>, cues: Set<string>): boolean {
  for (const cue of cues) {
    if (tokens.has(cue)) {
      return true;
    }
  }

  return false;
}
