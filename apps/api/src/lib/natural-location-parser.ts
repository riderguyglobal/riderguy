// ══════════════════════════════════════════════════════════
// Natural Language Location Parser — Ghana-specific
//
// Parses freeform location descriptions that Ghanaians
// commonly use when they don't have a formal address:
//
// • "Near the Total station at Lapaz"
// • "Behind Accra Mall"
// • "Opposite Madina Market"
// • "Spintex Road close to Palace Mall"
// • "After Shiashie traffic light"
// • "Achimota mile 7 junction area"
// • "KNUST campus gate 2"
//
// Strategy:
// 1. Extract relative position indicators (near, behind, opposite)
// 2. Extract landmark references (known places from gazetteer)
// 3. Extract area/neighborhood references
// 4. Return structured parsed components for smarter search
// ══════════════════════════════════════════════════════════

export interface ParsedLocation {
  /** The most likely searchable place name extracted */
  primaryPlace: string;
  /** The full original query for fallback */
  originalQuery: string;
  /** Relative position to landmark (if detected) */
  relativePosition?: 'near' | 'behind' | 'opposite' | 'after' | 'before' | 'beside' | 'inside' | 'at' | 'around';
  /** Reference landmark extracted from the query */
  landmark?: string;
  /** Area / neighborhood extracted */
  area?: string;
  /** Specific feature referenced (traffic light, junction, roundabout, etc.) */
  feature?: string;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Alternative search terms to try if primary doesn't match well */
  alternativeQueries: string[];
}

// ── Position indicators — words that signal relative location ──
const POSITION_PATTERNS: Array<{ pattern: RegExp; position: ParsedLocation['relativePosition'] }> = [
  { pattern: /\b(?:near|close\s+to|next\s+to|by|around|nearby|not\s+far\s+from)\b/i, position: 'near' },
  { pattern: /\b(?:behind|at\s+the\s+back\s+of|back\s+of)\b/i, position: 'behind' },
  { pattern: /\b(?:opposite|across\s+from|facing|in\s+front\s+of)\b/i, position: 'opposite' },
  { pattern: /\b(?:after|past|beyond)\b/i, position: 'after' },
  { pattern: /\b(?:before|just\s+before)\b/i, position: 'before' },
  { pattern: /\b(?:beside|adjacent\s+to|next\s+door)\b/i, position: 'beside' },
  { pattern: /\b(?:inside|within|in|at)\b/i, position: 'inside' },
];

// ── Feature words — things people reference as landmarks ──
const FEATURE_PATTERNS: Array<{ pattern: RegExp; feature: string }> = [
  { pattern: /\btraffic\s*lights?\b/i, feature: 'traffic light' },
  { pattern: /\bjunction\b/i, feature: 'junction' },
  { pattern: /\broundabout\b/i, feature: 'roundabout' },
  { pattern: /\boverpass\b/i, feature: 'overpass' },
  { pattern: /\bflyover\b/i, feature: 'flyover' },
  { pattern: /\bbridge\b/i, feature: 'bridge' },
  { pattern: /\bgate\s*\d*\b/i, feature: 'gate' },
  { pattern: /\btoll\s*(?:booth|plaza)?\b/i, feature: 'toll' },
  { pattern: /\bbus\s*stop\b/i, feature: 'bus stop' },
  { pattern: /\btaxi\s*(?:rank|station|stand)\b/i, feature: 'taxi station' },
  { pattern: /\btrotro\s*(?:station|stop|terminal)\b/i, feature: 'trotro station' },
  { pattern: /\bfilling\s*station\b/i, feature: 'filling station' },
  { pattern: /\bpetrol\s*station\b/i, feature: 'filling station' },
  { pattern: /\bgas\s*station\b/i, feature: 'filling station' },
];

// ── Brand names commonly used as landmarks in Ghana ──
const BRAND_LANDMARKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\btotal\b(?:\s+(?:filling|petrol|gas))?\s*(?:station)?\b/i, name: 'Total' },
  { pattern: /\bshell\b(?:\s+(?:filling|petrol|gas))?\s*(?:station)?\b/i, name: 'Shell' },
  { pattern: /\bgoil\b(?:\s+(?:filling|petrol|gas))?\s*(?:station)?\b/i, name: 'Goil' },
  { pattern: /\bfidelity\b(?:\s+bank)?\b/i, name: 'Fidelity Bank' },
  { pattern: /\bstanbic\b(?:\s+bank)?\b/i, name: 'Stanbic Bank' },
  { pattern: /\becobank\b/i, name: 'Ecobank' },
  { pattern: /\bgcb\b(?:\s+bank)?\b/i, name: 'GCB Bank' },
  { pattern: /\bcal\s*bank\b/i, name: 'CalBank' },
  { pattern: /\bmtn\b(?:\s+office)?\b/i, name: 'MTN' },
  { pattern: /\bvodafone\b/i, name: 'Vodafone' },
  { pattern: /\bairtel\b(?:\s*tigo)?\b/i, name: 'AirtelTigo' },
  { pattern: /\bmelcom\b/i, name: 'Melcom' },
  { pattern: /\bshoprite\b/i, name: 'Shoprite' },
  { pattern: /\bmax\s*mart\b/i, name: 'Max Mart' },
  { pattern: /\bpalace\s*mall\b/i, name: 'Palace Mall' },
  { pattern: /\baccra\s*mall\b/i, name: 'Accra Mall' },
  { pattern: /\bjunction\s*mall\b/i, name: 'Junction Mall' },
  { pattern: /\bwest\s*hills?\s*mall\b/i, name: 'West Hills Mall' },
  { pattern: /\bkfc\b/i, name: 'KFC' },
  { pattern: /\bchicken\s*inn\b/i, name: 'Chicken Inn' },
  { pattern: /\bpapaye\b/i, name: 'Papaye' },
  { pattern: /\bmarriott\b(?:\s+hotel)?\b/i, name: 'Marriott Hotel' },
  { pattern: /\bmovenpick\b/i, name: 'Movenpick' },
  { pattern: /\bkempinski\b/i, name: 'Kempinski Hotel' },
  { pattern: /\bnovotel\b/i, name: 'Novotel' },
  { pattern: /\b37\s*(?:military)?\s*hosp(?:ital)?\b/i, name: '37 Military Hospital' },
  { pattern: /\bkorle\s*bu\b/i, name: 'Korle Bu Teaching Hospital' },
  { pattern: /\bknust\b/i, name: 'KNUST' },
  { pattern: /\blegon\b(?:\s+campus)?\b/i, name: 'University of Ghana' },
  { pattern: /\bucc\b(?:\s+campus)?\b/i, name: 'UCC Campus' },
  { pattern: /\bashesi\b/i, name: 'Ashesi University' },
];

// ── Area / Neighborhood extraction ──
// These are stripped from the query to extract the landmark part
const AREA_CONNECTOR_PATTERN = /\b(?:at|in|around|area|side|part\s+of|towards?)\b/i;

/**
 * Parse a freeform location description into structured components.
 *
 * @param query Raw user input like "near the Total station at Lapaz"
 * @returns Structured parsed location with search hints
 */
export function parseNaturalLocation(query: string): ParsedLocation {
  const original = query.trim();
  let working = original;
  let confidence = 0.3; // Base confidence
  let relativePosition: ParsedLocation['relativePosition'] | undefined;
  let landmark: string | undefined;
  let area: string | undefined;
  let feature: string | undefined;

  // ── Step 1: Extract relative position ──
  for (const { pattern, position } of POSITION_PATTERNS) {
    const match = working.match(pattern);
    if (match && match.index !== undefined) {
      relativePosition = position;
      // Remove the position indicator from working text
      working = (working.substring(0, match.index) + working.substring(match.index + match[0].length)).trim();
      confidence += 0.1;
      break;
    }
  }

  // ── Step 2: Extract feature references ──
  for (const { pattern, feature: feat } of FEATURE_PATTERNS) {
    const match = working.match(pattern);
    if (match) {
      feature = feat;
      working = working.replace(match[0], '').trim();
      confidence += 0.05;
      break;
    }
  }

  // ── Step 3: Extract brand/landmark references ──
  for (const { pattern, name } of BRAND_LANDMARKS) {
    const match = working.match(pattern);
    if (match) {
      landmark = name;
      working = working.replace(match[0], '').trim();
      confidence += 0.15;
      break;
    }
  }

  // ── Step 4: Extract area name (what's left after removing connectors) ──
  // Remove common connector words
  working = working.replace(AREA_CONNECTOR_PATTERN, ' ').trim();
  working = working.replace(/\bthe\b/gi, '').trim();
  working = working.replace(/\s+/g, ' ').trim();

  if (working.length > 1) {
    area = working;
    confidence += 0.1;
  }

  // ── Step 5: Build primary search term ──
  // Combine landmark + area for the best search query
  const parts: string[] = [];
  if (landmark) parts.push(landmark);
  if (area) parts.push(area);
  const primaryPlace = parts.join(' ').trim() || original;

  // ── Step 6: Build alternative queries ──
  const alternativeQueries: string[] = [];

  // Try landmark alone
  if (landmark && area) {
    alternativeQueries.push(landmark);
    alternativeQueries.push(area);
    alternativeQueries.push(`${landmark} ${area}`);
    alternativeQueries.push(`${area} ${landmark}`);
  }

  // If we found a feature (junction, traffic light), try area + feature
  if (feature && area) {
    alternativeQueries.push(`${area} ${feature}`);
  }

  // Try the original query cleaned up
  const cleaned = original
    .replace(/\b(?:near|close to|next to|behind|opposite|after|before|beside|the)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned !== primaryPlace && cleaned.length > 2) {
    alternativeQueries.push(cleaned);
  }

  // Deduplicate alternatives
  const uniqueAlts = [...new Set(alternativeQueries.filter((q) => q !== primaryPlace && q.length > 1))];

  // Adjust confidence based on how much we understood
  if (landmark && area) confidence = Math.min(confidence + 0.2, 0.95);
  else if (landmark || area) confidence = Math.min(confidence + 0.1, 0.75);

  return {
    primaryPlace,
    originalQuery: original,
    relativePosition,
    landmark,
    area,
    feature,
    confidence,
    alternativeQueries: uniqueAlts,
  };
}

/**
 * Check if a query looks like natural language (not a simple place name).
 * Used to decide whether to invoke the NLP parser.
 */
export function isNaturalLanguageQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Contains relative position words
  for (const { pattern } of POSITION_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  // Contains feature words
  for (const { pattern } of FEATURE_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  // Contains connector phrases suggesting description
  if (/\b(?:close to|next to|not far from|back of|in front of|across from)\b/i.test(lower)) {
    return true;
  }

  // Long queries with multiple words are likely natural language
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 4) return true;

  return false;
}
