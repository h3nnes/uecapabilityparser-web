import type { ComboNr, ComponentNr, Bandwidth } from '~/@types/uecapabilityparser';

/**
 * Criteria for bandwidth filtering
 */
export interface BandwidthCriteria {
  band: number;
  minBandwidthDl: number; // in MHz
}

/**
 * Parse bandwidth filter input string
 * Format: "band:bw, band:bw, ..." e.g., "78:100, 28:30, 3:30"
 * Returns null if invalid format
 */
export function parseBandwidthFilter(input: string): BandwidthCriteria[] | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const pairs = trimmed.split(',');
  const criteria: BandwidthCriteria[] = [];

  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) {
      continue; // Skip empty entries
    }

    const parts = trimmedPair.split(':');
    if (parts.length !== 2) {
      return null; // Invalid format
    }

    const band = parseInt(parts[0].trim(), 10);
    const bandwidth = parseInt(parts[1].trim(), 10);

    if (isNaN(band) || isNaN(bandwidth) || band <= 0 || bandwidth <= 0) {
      return null; // Invalid numbers
    }

    criteria.push({
      band,
      minBandwidthDl: bandwidth,
    });
  }

  return criteria.length > 0 ? criteria : null;
}

/**
 * Extract maximum bandwidth value from Bandwidth type
 * Returns 0 for empty or invalid bandwidth
 */
export function extractMaxBandwidth(bw?: Bandwidth): number {
  if (!bw || bw.type === 'empty' || bw.type === 'invalid') {
    return 0;
  }

  if (bw.type === 'single') {
    return bw.value;
  }

  if (bw.type === 'mixed') {
    return Math.max(...bw.value);
  }

  return 0;
}

/**
 * Check if a combo matches the bandwidth criteria
 * All criteria must be satisfied (AND logic)
 */
export function matchesBandwidthFilter(
  combo: ComboNr,
  criteria: BandwidthCriteria[],
): boolean {
  if (!criteria || criteria.length === 0) {
    return true; // No filter, show all
  }

  // For each criterion, check if the combo has a matching component
  for (const criterion of criteria) {
    const matchingComponent = combo.components.find(
      (component: ComponentNr) => component.band === criterion.band,
    );

    if (!matchingComponent) {
      return false; // Band not found in combo
    }

    const actualBandwidth = extractMaxBandwidth(matchingComponent.maxBwDl);

    if (actualBandwidth < criterion.minBandwidthDl) {
      return false; // Bandwidth too low
    }
  }

  return true; // All criteria satisfied
}

/**
 * Filter an array of combos by bandwidth criteria
 */
export function filterCombosByBandwidth(
  combos: ComboNr[],
  criteria: BandwidthCriteria[] | null,
): ComboNr[] {
  if (!criteria || criteria.length === 0) {
    return combos;
  }

  return combos.filter((combo) => matchesBandwidthFilter(combo, criteria));
}

/**
 * Validate bandwidth filter input
 * Returns error message if invalid, empty string if valid
 */
export function validateBandwidthFilter(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return ''; // Empty is valid (no filter)
  }

  const result = parseBandwidthFilter(input);
  if (result === null) {
    return 'Invalid format. Use: band:bw, band:bw (e.g., 78:100, 28:30)';
  }

  return '';
}
