import type {
  Capabilities,
  ComboLte,
  ComboEnDc,
  ComboNr,
  ComboNrDc,
  ComponentLte,
  ComponentNr,
  Mimo,
  Bandwidth,
} from '~/@types/uecapabilityparser';
import {
  bwClassCCs,
  componentsDlToStr,
} from '~/helpers/combos';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComboType = 'LTE' | 'ENDC' | 'NRCA' | 'NRDC';

export interface SearchComponent {
  band: number;
  nr: boolean;
  dlClass: string;
  mimoDl: number[];
  bwDl?: number[];
  ulClass?: string;
  mimoUl?: number[];
  bwUl?: number[];
}

export interface SearchCombo {
  components: SearchComponent[];
}

export type ParseResult =
  | { success: true; combo: SearchCombo }
  | { success: false; error: string };

export interface SearchResult {
  logIndex: number;
  comboIndex: number;
  combo: ComboLte | ComboEnDc | ComboNr | ComboNrDc;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a compact combo search string (e.g. "28a2a+3a4+7c44a+20a2") into a
 * structured SearchCombo.
 */
export function parseComboString(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: 'Empty input' };
  }

  const parts = trimmed.split('+');
  const components: SearchComponent[] = [];

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) {
      return { success: false, error: 'Empty component in combo string' };
    }

    const result = parseComponent(trimmedPart);
    if (!result.success) {
      return result;
    }
    components.push(result.component);
  }

  return { success: true, combo: { components } };
}

type ComponentResult =
  | { success: true; component: SearchComponent }
  | { success: false; error: string };

function parseComponent(str: string): ComponentResult {
  let s = str;
  let nr = false;

  if (s[0] === 'n' || s[0] === 'N') {
    nr = true;
    s = s.slice(1);
  }

  // Parse band (leading digits)
  const bandMatch = s.match(/^(\d+)/);
  if (!bandMatch) {
    return { success: false, error: `No band number found in "${str}"` };
  }
  const band = parseInt(bandMatch[1], 10);
  s = s.slice(bandMatch[1].length);

  // Parse DL class (single letter)
  if (s.length === 0 || !/[a-zA-Z]/.test(s[0])) {
    return { success: false, error: `No class letter found in "${str}"` };
  }
  const dlClass = s[0].toUpperCase();
  s = s.slice(1);

  if (!isValidClass(band, dlClass, nr)) {
    return { success: false, error: `Invalid class letter "${dlClass}" for band ${band} (${nr ? 'NR' : 'LTE'}) in "${str}"` };
  }

  const carrierCount = bwClassCCs(band, dlClass, nr);

  // Parse DL MIMO digits (exactly carrierCount digits)
  if (s.length < carrierCount) {
    return {
      success: false,
      error: `Expected ${carrierCount} MIMO digit(s) for band ${band} class ${dlClass} in "${str}"`,
    };
  }
  const mimoDlStr = s.slice(0, carrierCount);
  if (!/^\d+$/.test(mimoDlStr)) {
    return {
      success: false,
      error: `Expected ${carrierCount} MIMO digit(s) in "${str}", got "${mimoDlStr}"`,
    };
  }
  const mimoDl = mimoDlStr.split('').map((d) => parseInt(d, 10));
  s = s.slice(carrierCount);

  const component: SearchComponent = { band, nr, dlClass, mimoDl };

  if (nr) {
    // Parse optional bwDl (":number_number_...")
    if (s[0] === ':') {
      s = s.slice(1);
      const pipeIdx = s.indexOf('|');
      const bwDlStr = pipeIdx === -1 ? s : s.slice(0, pipeIdx);
      const bwResult = parseBwValues(bwDlStr, carrierCount, str);
      if (!bwResult.success) return bwResult;
      component.bwDl = bwResult.values;
      s = pipeIdx === -1 ? '' : s.slice(pipeIdx);
    }

    // Parse optional UL section ("|ulClass mimoUlDigits? :bwUl?")
    if (s[0] === '|') {
      s = s.slice(1);
      if (s.length === 0 || !/[a-zA-Z]/.test(s[0])) {
        return { success: false, error: `No UL class letter found in "${str}"` };
      }
      const ulClass = s[0].toUpperCase();
      component.ulClass = ulClass;
      s = s.slice(1);

      if (!isValidClass(band, ulClass, true)) {
        return { success: false, error: `Invalid UL class letter "${ulClass}" for band ${band} (NR) in "${str}"` };
      }

      const ulCarrierCount = bwClassCCs(band, ulClass, true);

      // Optional UL MIMO digits
      if (s.length > 0 && /^\d/.test(s)) {
        if (s.length < ulCarrierCount) {
          return {
            success: false,
            error: `Expected ${ulCarrierCount} UL MIMO digit(s) in "${str}"`,
          };
        }
        const mimoUlStr = s.slice(0, ulCarrierCount);
        if (!/^\d+$/.test(mimoUlStr)) {
          return {
            success: false,
            error: `Expected ${ulCarrierCount} UL MIMO digit(s) in "${str}"`,
          };
        }
        component.mimoUl = mimoUlStr.split('').map((d) => parseInt(d, 10));
        s = s.slice(ulCarrierCount);
      }

      // Optional bwUl
      if (s[0] === ':') {
        s = s.slice(1);
        const bwResult = parseBwValues(s, ulCarrierCount, str);
        if (!bwResult.success) return bwResult;
        component.bwUl = bwResult.values;
        s = '';
      }
    }
  } else {
    // LTE: optional UL class (single letter after MIMO digits)
    if (s.length > 0 && /[a-zA-Z]/.test(s[0])) {
      component.ulClass = s[0].toUpperCase();
      s = s.slice(1);
    }
  }

  if (s.length > 0) {
    return { success: false, error: `Unexpected characters "${s}" in "${str}"` };
  }

  return { success: true, component };
}

type BwResult =
  | { success: true; values: number[] }
  | { success: false; error: string };

/**
 * Parse bandwidth values: "100_40" → [100, 40], "100x8" → [100]*8.
 */
function parseBwValues(
  str: string,
  expectedCount: number,
  original: string,
): BwResult {
  const parts = str.split('_');
  const values: number[] = [];

  for (const part of parts) {
    const xMatch = part.match(/^(\d+)[x\u00d7](\d+)$/);
    if (xMatch) {
      const val = parseInt(xMatch[1], 10);
      const count = parseInt(xMatch[2], 10);
      for (let i = 0; i < count; i++) {
        values.push(val);
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num)) {
        return { success: false, error: `Invalid bandwidth "${part}" in "${original}"` };
      }
      values.push(num);
    }
  }

  if (values.length !== expectedCount) {
    return {
      success: false,
      error: `Expected ${expectedCount} bandwidth value(s), got ${values.length} in "${original}"`,
    };
  }

  return { success: true, values };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const LTE_CLASSES = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
const NR_FR1_CLASSES = new Set([
  'A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
]);
const NR_FR2_CLASSES = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
  'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12',
]);

function isValidClass(band: number, bwClass: string, nr: boolean): boolean {
  if (!nr) return LTE_CLASSES.has(bwClass);
  if (band <= 256) return NR_FR1_CLASSES.has(bwClass);
  return NR_FR2_CLASSES.has(bwClass);
}

/**
 * Validate that the parsed combo's component types are compatible with the
 * selected combo type. Returns null if valid, error string if not.
 */
export function validateComboType(
  combo: SearchCombo,
  comboType: ComboType,
): string | null {
  for (const comp of combo.components) {
    if (comboType === 'LTE' && comp.nr) {
      return 'LTE search cannot contain NR bands (n prefix)';
    }
    if ((comboType === 'NRCA' || comboType === 'NRDC') && !comp.nr) {
      return `${comboType} search must use NR bands (n prefix)`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matcher helpers
// ---------------------------------------------------------------------------

/**
 * Expand a Mimo type to a per-carrier array.
 * Returns null if there is no MIMO constraint (undefined or empty).
 */
function expandMimo(
  mimo: Mimo | undefined,
  carrierCount: number,
): number[] | null {
  if (mimo === undefined || mimo.type === 'empty') {
    return null;
  }
  const value = mimo.value;
  if (Array.isArray(value)) {
    return value;
  }
  return new Array(carrierCount).fill(value);
}

/**
 * Expand a Bandwidth type to a per-carrier array.
 * Returns null if there is no BW constraint (undefined, empty, or invalid).
 */
function expandBandwidth(
  bw: Bandwidth | undefined,
  carrierCount: number,
): number[] | null {
  if (bw === undefined || bw.type === 'empty' || bw.type === 'invalid') {
    return null;
  }
  if (bw.type === 'single') {
    return new Array(carrierCount).fill(bw.value);
  }
  return bw.value;
}

/**
 * Check that every search value is <= some log value (at-minimum match).
 * Greedy: sort both descending, check search[i] <= log[i].
 */
function permutationAtLeast(
  search: number[],
  log: number[] | null,
): boolean {
  if (log === null) {
    return true;
  }
  if (search.length > log.length) {
    return false;
  }
  const sortedSearch = [...search].sort((a, b) => b - a);
  const sortedLog = [...log].sort((a, b) => b - a);
  for (let i = 0; i < sortedSearch.length; i++) {
    if (sortedSearch[i] > sortedLog[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a search component matches a log component.
 */
function componentMatches(
  search: SearchComponent,
  log: ComponentLte | ComponentNr,
): boolean {
  if (search.band !== log.band) return false;

  if (log.bwClassDl !== search.dlClass) return false;

  const carrierCount = bwClassCCs(search.band, search.dlClass, search.nr);

  // DL MIMO
  const logMimoDl = expandMimo(log.mimoDl, carrierCount);
  if (!permutationAtLeast(search.mimoDl, logMimoDl)) return false;

  // DL BW (NR only)
  if (search.bwDl) {
    const logNr = log as ComponentNr;
    const logBwDl = expandBandwidth(logNr.maxBwDl, carrierCount);
    if (!permutationAtLeast(search.bwDl, logBwDl)) return false;
  }

  // UL
  if (search.ulClass) {
    if (log.bwClassUl !== search.ulClass) return false;

    const ulCarrierCount = bwClassCCs(search.band, search.ulClass, search.nr);

    if (search.mimoUl) {
      const logMimoUl = expandMimo(log.mimoUl, ulCarrierCount);
      if (!permutationAtLeast(search.mimoUl, logMimoUl)) return false;
    }

    if (search.bwUl) {
      const logNr = log as ComponentNr;
      const logBwUl = expandBandwidth(logNr.maxBwUl, ulCarrierCount);
      if (!permutationAtLeast(search.bwUl, logBwUl)) return false;
    }
  }

  return true;
}

/**
 * Check if a valid bipartite assignment exists: each search component must
 * get a distinct matching log component.
 */
function canAssign(
  searchCount: number,
  logCount: number,
  matchMatrix: boolean[][],
): boolean {
  const used = new Array(logCount).fill(false);

  function backtrack(searchIdx: number): boolean {
    if (searchIdx === searchCount) {
      return true;
    }
    for (let logIdx = 0; logIdx < logCount; logIdx++) {
      if (!used[logIdx] && matchMatrix[searchIdx][logIdx]) {
        used[logIdx] = true;
        if (backtrack(searchIdx + 1)) {
          return true;
        }
        used[logIdx] = false;
      }
    }
    return false;
  }

  return backtrack(0);
}

/**
 * Check if all search components can be matched to distinct log components.
 */
function matchSubset(
  searchComps: SearchComponent[],
  logComps: (ComponentLte | ComponentNr)[],
): boolean {
  if (searchComps.length === 0) return true;
  if (searchComps.length > logComps.length) return false;

  const matchMatrix: boolean[][] = [];
  for (let i = 0; i < searchComps.length; i++) {
    matchMatrix.push([]);
    for (let j = 0; j < logComps.length; j++) {
      matchMatrix[i][j] = componentMatches(searchComps[i], logComps[j]);
    }
  }

  return canAssign(searchComps.length, logComps.length, matchMatrix);
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Check if a single log combo matches the search combo.
 */
export function matchCombo(
  searchCombo: SearchCombo,
  logCombo: ComboLte | ComboEnDc | ComboNr | ComboNrDc,
  comboType: ComboType,
): boolean {
  const searchComps = searchCombo.components;

  switch (comboType) {
    case 'LTE': {
      const logComps = (logCombo as ComboLte).components ?? [];
      return matchSubset(searchComps, logComps);
    }
    case 'NRCA': {
      const logComps = (logCombo as ComboNr).components ?? [];
      return matchSubset(searchComps, logComps);
    }
    case 'ENDC': {
      const logEndc = logCombo as ComboEnDc;
      const lteSearch = searchComps.filter((c) => !c.nr);
      const nrSearch = searchComps.filter((c) => c.nr);
      return (
        matchSubset(lteSearch, logEndc.componentsLte ?? []) &&
        matchSubset(nrSearch, logEndc.componentsNr ?? [])
      );
    }
    case 'NRDC': {
      const logNrdc = logCombo as ComboNrDc;
      const fr1Search = searchComps.filter((c) => c.band <= 256);
      const fr2Search = searchComps.filter((c) => c.band > 256);
      return (
        matchSubset(fr1Search, logNrdc.componentsFr1 ?? []) &&
        matchSubset(fr2Search, logNrdc.componentsFr2 ?? [])
      );
    }
  }
}

/**
 * Search across all logs in a parsing submission.
 * Returns all matching combos with their log/combo indices.
 */
export function searchCombos(
  searchCombo: SearchCombo,
  comboType: ComboType,
  capabilitiesList: Capabilities[],
): SearchResult[] {
  const results: SearchResult[] = [];

  capabilitiesList.forEach((caps, logIndex) => {
    const combos = getCombos(caps, comboType);
    if (!combos) return;

    combos.forEach((combo, comboIndex) => {
      if (matchCombo(searchCombo, combo, comboType)) {
        results.push({ logIndex, comboIndex, combo });
      }
    });
  });

  return results;
}

function getCombos(
  caps: Capabilities,
  comboType: ComboType,
): (ComboLte | ComboEnDc | ComboNr | ComboNrDc)[] | undefined {
  switch (comboType) {
    case 'LTE':
      return caps.lteca;
    case 'ENDC':
      return caps.endc;
    case 'NRCA':
      return caps.nrca;
    case 'NRDC':
      return caps.nrdc;
  }
}

// ---------------------------------------------------------------------------
// Rendering helper
// ---------------------------------------------------------------------------

/**
 * Render a combo as an HTML string for display in results.
 */
export function renderCombo(
  combo: ComboLte | ComboEnDc | ComboNr | ComboNrDc,
  comboType: ComboType,
): string {
  switch (comboType) {
    case 'LTE':
      return componentsDlToStr((combo as ComboLte).components);
    case 'ENDC': {
      const c = combo as ComboEnDc;
      return (
        componentsDlToStr(c.componentsLte) +
        ' + ' +
        componentsDlToStr(c.componentsNr, true)
      );
    }
    case 'NRCA':
      return componentsDlToStr((combo as ComboNr).components, true);
    case 'NRDC': {
      const c = combo as ComboNrDc;
      return (
        componentsDlToStr(c.componentsFr1, true) +
        ' + ' +
        componentsDlToStr(c.componentsFr2, true)
      );
    }
  }
}
