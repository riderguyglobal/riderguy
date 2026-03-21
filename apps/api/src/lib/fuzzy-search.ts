// ══════════════════════════════════════════════════════════
// Fuzzy Search Engine — typo-tolerant matching for Ghana
// location search using trigram similarity + Levenshtein
// distance + phonetic normalization.
//
// This replaces simple substring matching with intelligent
// fuzzy matching that handles:
// • Typos: "Madina Markket" → "Madina Market"
// • Phonetic variants: "Kwesi Mintim" → "Kwesimintsim"
// • Abbreviations: "Spintex Rd" → "Spintex Road"
// • Missing spaces: "eastlegon" → "East Legon"
// • Transpositions: "Obuais" → "Obuasi"
// ══════════════════════════════════════════════════════════

// ── Ghana Address Normalization ─────────────────────────
// Common abbreviations and alternate spellings seen in
// Ghanaian addresses. Applied before any matching.

const ADDRESS_NORMALIZATIONS: [RegExp, string][] = [
  // Street type abbreviations
  [/\brd\b/gi, 'road'],
  [/\bst\b/gi, 'street'],
  [/\bave?\b/gi, 'avenue'],
  [/\bdr\b/gi, 'drive'],
  [/\bln\b/gi, 'lane'],
  [/\bjct\b/gi, 'junction'],
  [/\bjn\b/gi, 'junction'],
  [/\bhwy\b/gi, 'highway'],
  [/\bblvd\b/gi, 'boulevard'],
  [/\bcres\b/gi, 'crescent'],
  [/\bext\b/gi, 'extension'],

  // Directional abbreviations
  [/\bn\b/gi, 'north'],
  [/\bs\b/gi, 'south'],
  [/\be\b/gi, 'east'],
  [/\bw\b/gi, 'west'],

  // Ghana-specific normalizations
  [/\bnkwanta\b/gi, 'nkwanta'],
  [/\bjunction\b/gi, 'junction'],
  [/\broundabout\b/gi, 'roundabout'],
  [/\br\/about\b/gi, 'roundabout'],
  [/\bhosp\b/gi, 'hospital'],
  [/\buniv\b/gi, 'university'],
  [/\bmkt\b/gi, 'market'],
  [/\bstn\b/gi, 'station'],
  [/\bsch\b/gi, 'school'],
  [/\bpri\b/gi, 'primary'],
  [/\bjhs\b/gi, 'junior high school'],
  [/\bshs\b/gi, 'senior high school'],

  // Common Ghanaian spelling variants
  [/\blabadi\b/gi, 'labadi'],
  [/\bla\b/gi, 'la'],
  [/\btema\b/gi, 'tema'],
];

/**
 * Normalize a Ghana address/location string for matching.
 * Expands abbreviations, normalizes spacing, removes punctuation.
 */
export function normalizeAddress(text: string): string {
  let normalized = text.toLowerCase().trim();
  // Remove punctuation except hyphens (common in Ghana place names)
  normalized = normalized.replace(/[^\w\s-]/g, '');
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  // Apply address-specific normalizations
  for (const [pattern, replacement] of ADDRESS_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.trim();
}

// ── Trigram Generation ──────────────────────────────────
// Trigrams (3-character substrings) are excellent for fuzzy
// matching because:
// • A single typo only affects 3 trigrams
// • Shared trigrams correlate with string similarity
// • O(n) generation, O(1) lookup per trigram

/**
 * Generate trigrams (3-char substrings) from a string.
 * Pads with spaces to capture word boundaries.
 */
export function generateTrigrams(text: string): Set<string> {
  const padded = `  ${text.toLowerCase()} `;
  const trigrams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  return trigrams;
}

/**
 * Calculate trigram similarity between two strings.
 * Returns 0.0–1.0 (1.0 = identical trigram sets).
 * This is equivalent to PostgreSQL's pg_trgm similarity().
 */
export function trigramSimilarity(a: string, b: string): number {
  const triA = generateTrigrams(a.toLowerCase());
  const triB = generateTrigrams(b.toLowerCase());

  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }

  const union = triA.size + triB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Levenshtein Distance ────────────────────────────────
// Classic edit distance with early termination when distance
// exceeds the threshold — O(nm) worst case but typically
// much faster with threshold pruning.

/**
 * Calculate Levenshtein edit distance between two strings.
 * Returns early if distance exceeds maxDist.
 *
 * @param a First string
 * @param b Second string
 * @param maxDist Maximum distance to compute (optimization)
 * @returns Edit distance, or maxDist+1 if exceeded
 */
export function levenshteinDistance(a: string, b: string, maxDist = 5): number {
  const la = a.length;
  const lb = b.length;

  // Quick length check
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use single-row optimization (O(min(la,lb)) space)
  const shorter = la < lb ? a : b;
  const longer = la < lb ? b : a;
  const sl = shorter.length;
  const ll = longer.length;

  const row = new Array<number>(sl + 1);
  for (let i = 0; i <= sl; i++) row[i] = i;

  for (let i = 1; i <= ll; i++) {
    let prev = row[0]!;
    row[0] = i;
    let minInRow = i;

    for (let j = 1; j <= sl; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      const val = Math.min(
        row[j]! + 1,        // deletion
        row[j - 1]! + 1,    // insertion
        prev + cost,         // substitution
      );
      prev = row[j]!;
      row[j] = val;
      minInRow = Math.min(minInRow, val);
    }

    // Early termination: if minimum possible distance exceeds threshold
    if (minInRow > maxDist) return maxDist + 1;
  }

  return row[sl]!;
}

/**
 * Normalized Levenshtein similarity (0.0–1.0).
 * 1.0 = identical, 0.0 = completely different.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase(), maxLen);
  return 1 - dist / maxLen;
}

// ── Damerau-Levenshtein (transposition-aware) ───────────
// Handles adjacent character swaps (e.g., "teh" → "the")
// which is the most common typo on mobile keyboards.

/**
 * Damerau-Levenshtein distance — like Levenshtein but also
 * counts adjacent transpositions as a single edit.
 */
export function damerauLevenshtein(a: string, b: string, maxDist = 5): number {
  const la = a.length;
  const lb = b.length;

  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Full matrix needed for transposition detection
  const d = new Array<number[]>(la + 1);
  for (let i = 0; i <= la; i++) {
    d[i] = new Array<number>(lb + 1).fill(0);
    d[i]![0] = i;
  }
  for (let j = 0; j <= lb; j++) {
    d[0]![j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,      // deletion
        d[i]![j - 1]! + 1,      // insertion
        d[i - 1]![j - 1]! + cost, // substitution
      );
      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + cost);
      }
    }
  }

  return d[la]![lb]!;
}

// ── Combined Fuzzy Score ────────────────────────────────
// Combines multiple signals into a single relevance score.

export interface FuzzyMatchResult {
  /** Combined fuzzy score 0.0–1.0 (higher = better match) */
  score: number;
  /** Match type for debugging */
  matchType: 'exact' | 'prefix' | 'fuzzy-high' | 'fuzzy-medium' | 'fuzzy-low' | 'none';
  /** Trigram similarity component */
  trigramScore: number;
  /** Edit distance (Damerau-Levenshtein) */
  editDistance: number;
}

/**
 * Calculate a combined fuzzy match score between a query and a candidate string.
 * Uses trigram similarity + Damerau-Levenshtein distance + prefix detection.
 *
 * Returns a score from 0.0 to 1.0 where:
 * - 1.0 = exact match
 * - 0.85+ = very close (1 typo)
 * - 0.65+ = decent match (2 typos or partial)
 * - 0.45+ = weak match (might be relevant)
 * - <0.45 = no match
 *
 * @param query User's search input (normalized)
 * @param candidate Place name to match against (normalized)
 */
export function fuzzyMatch(query: string, candidate: string): FuzzyMatchResult {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  // Exact match
  if (q === c) {
    return { score: 1.0, matchType: 'exact', trigramScore: 1.0, editDistance: 0 };
  }

  // Prefix match (very strong signal — user is still typing)
  if (c.startsWith(q) || q.startsWith(c)) {
    const lenRatio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    return { score: 0.85 + lenRatio * 0.1, matchType: 'prefix', trigramScore: 1.0, editDistance: 0 };
  }

  // Word-level prefix: "east leg" matches "east legon"
  const qWords = q.split(/\s+/);
  const cWords = c.split(/\s+/);
  if (qWords.length > 1 && cWords.length > 0) {
    const allWordsMatch = qWords.every((qw) =>
      cWords.some((cw) => cw.startsWith(qw) || qw.startsWith(cw)),
    );
    if (allWordsMatch) {
      return { score: 0.88, matchType: 'prefix', trigramScore: 0.9, editDistance: 0 };
    }
  }

  // Substring match (candidate contains query or vice versa)
  if (c.includes(q)) {
    const ratio = q.length / c.length;
    return { score: 0.7 + ratio * 0.15, matchType: 'fuzzy-high', trigramScore: 0.8, editDistance: 0 };
  }

  // Compute fuzzy metrics
  const tSim = trigramSimilarity(q, c);
  const maxAllowedDist = Math.max(1, Math.floor(q.length * 0.35)); // Allow ~35% of query length as errors
  const editDist = damerauLevenshtein(q, c, maxAllowedDist);
  const editSim = editDist <= maxAllowedDist
    ? 1 - editDist / Math.max(q.length, c.length)
    : 0;

  // Per-word fuzzy: each query word fuzzy-matches at least one candidate word
  let wordFuzzyScore = 0;
  if (qWords.length > 0 && cWords.length > 0) {
    let matchedWords = 0;
    for (const qw of qWords) {
      const bestWordSim = Math.max(
        ...cWords.map((cw) => trigramSimilarity(qw, cw)),
        0,
      );
      if (bestWordSim > 0.3) matchedWords++;
    }
    wordFuzzyScore = matchedWords / qWords.length;
  }

  // Combine signals: trigram (40%), edit distance (30%), word-level (30%)
  const combined = tSim * 0.4 + editSim * 0.3 + wordFuzzyScore * 0.3;

  let matchType: FuzzyMatchResult['matchType'] = 'none';
  if (combined >= 0.65) matchType = 'fuzzy-high';
  else if (combined >= 0.45) matchType = 'fuzzy-medium';
  else if (combined >= 0.30) matchType = 'fuzzy-low';

  return {
    score: combined,
    matchType,
    trigramScore: tSim,
    editDistance: editDist,
  };
}

// ── Trigram Index for Fast Lookups ──────────────────────
// Pre-computes trigrams for all gazetteer entries so we
// don't recompute them on every search.

export interface IndexedEntry {
  /** Original index in the source array */
  index: number;
  /** Normalized name for matching */
  normalizedName: string;
  /** Pre-computed trigrams */
  trigrams: Set<string>;
}

/**
 * Build a trigram index for fast fuzzy lookup.
 * Call once at startup, then use searchIndex() for queries.
 */
export function buildTrigramIndex(
  entries: Array<{ name: string; altNames?: string[] }>,
): IndexedEntry[] {
  const indexed: IndexedEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const norm = normalizeAddress(entry.name);
    indexed.push({
      index: i,
      normalizedName: norm,
      trigrams: generateTrigrams(norm),
    });
    // Index alternate names too
    if (entry.altNames) {
      for (const alt of entry.altNames) {
        indexed.push({
          index: i,
          normalizedName: normalizeAddress(alt),
          trigrams: generateTrigrams(normalizeAddress(alt)),
        });
      }
    }
  }

  return indexed;
}

/**
 * Search an indexed dataset using trigram pre-filtering + full fuzzy scoring.
 *
 * Strategy:
 * 1. Generate query trigrams
 * 2. Pre-filter: only score entries that share at least 1 trigram (fast reject)
 * 3. Full fuzzy score on candidates (expensive but few)
 *
 * @param query User's search text
 * @param index Pre-built trigram index
 * @param minScore Minimum combined score to include (default 0.30)
 * @param limit Max results to return
 */
export function searchTrigramIndex(
  query: string,
  index: IndexedEntry[],
  minScore = 0.30,
  limit = 20,
): Array<{ index: number; score: number; matchType: string }> {
  const normQ = normalizeAddress(query);
  if (normQ.length < 2) return [];

  const queryTrigrams = generateTrigrams(normQ);

  // Pre-filter: require at least 1 shared trigram
  const candidates: Array<{ idx: number; overlapCount: number }> = [];
  for (const entry of index) {
    let overlap = 0;
    for (const t of queryTrigrams) {
      if (entry.trigrams.has(t)) overlap++;
    }
    // Require at least 20% trigram overlap for short queries, 10% for long ones
    const minOverlap = normQ.length <= 4 ? 1 : Math.max(1, Math.floor(queryTrigrams.size * 0.1));
    if (overlap >= minOverlap) {
      candidates.push({ idx: entry.index, overlapCount: overlap });
    }
  }

  // Full fuzzy score on candidates
  const results = new Map<number, { score: number; matchType: string }>();

  for (const { idx } of candidates) {
    if (results.has(idx)) continue; // Already scored this entry via another alt name
    const entry = index.find((e) => e.index === idx);
    if (!entry) continue;

    const match = fuzzyMatch(normQ, entry.normalizedName);
    if (match.score >= minScore) {
      const existing = results.get(idx);
      if (!existing || match.score > existing.score) {
        results.set(idx, { score: match.score, matchType: match.matchType });
      }
    }
  }

  // Sort by score descending
  return Array.from(results.entries())
    .map(([index, { score, matchType }]) => ({ index, score, matchType }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
