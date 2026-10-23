import type {
  ComboEnDc,
  ComboNr,
  ComponentLte,
  ComponentNr,
  Mimo,
} from '~/@types/uecapabilityparser';

/**
 * Low-band definitions for LTE and NR
 * These bands are typically sub-1GHz bands used for coverage
 */
export const LTE_LOWBANDS = new Set([
  5, 6, 8, 12, 13, 14, 17, 18, 19, 20, 26, 27, 28, 29, 31, 44, 67, 68, 71, 72,
  73, 85, 87, 88, 103, 106, 107, 108,
]);

export const NR_LOWBANDS = new Set([
  5, 8, 12, 13, 14, 18, 20, 26, 28, 29, 31, 67, 71, 72, 81, 82, 83, 85, 89, 91,
  92, 93, 94, 100, 105, 106, 109,
]);

/**
 * Extract the maximum MIMO value from a Mimo type
 * Returns 0 for empty or undefined MIMO
 */
function extractMaxMimo(mimo?: Mimo): number {
  if (!mimo || mimo.type === 'empty') {
    return 0;
  }

  if (mimo.type === 'single') {
    return mimo.value;
  }

  if (mimo.type === 'mixed') {
    return Math.max(...mimo.value);
  }

  return 0;
}

/**
 * Check if an LTE component is a low-band with 4Rx MIMO DL
 */
function isLteLowband4Rx(component: ComponentLte): boolean {
  if (!LTE_LOWBANDS.has(component.band)) {
    return false;
  }
  return extractMaxMimo(component.mimoDl) >= 4;
}

/**
 * Check if an NR component is a low-band with 4Rx MIMO DL
 */
function isNrLowband4Rx(component: ComponentNr): boolean {
  if (!NR_LOWBANDS.has(component.band)) {
    return false;
  }
  return extractMaxMimo(component.mimoDl) >= 4;
}

/**
 * Check if an EN-DC combo has at least one low-band (LTE or NR) with 4Rx MIMO
 */
export function hasEndcLowband4Rx(combo: ComboEnDc): boolean {
  // Check LTE components
  const hasLteLowband4Rx = combo.componentsLte.some(isLteLowband4Rx);
  if (hasLteLowband4Rx) {
    return true;
  }

  // Check NR components
  const hasNrLowband4Rx = combo.componentsNr.some(isNrLowband4Rx);
  return hasNrLowband4Rx;
}

/**
 * Check if an NR-CA combo has at least one NR low-band with 4Rx MIMO
 */
export function hasNrcaLowband4Rx(combo: ComboNr): boolean {
  return combo.components.some(isNrLowband4Rx);
}

/**
 * Filter EN-DC combos to only include those with at least one low-band 4Rx MIMO
 */
export function filterEndcByLowband4Rx(
  combos: ComboEnDc[],
  enabled: boolean,
): ComboEnDc[] {
  if (!enabled) {
    return combos;
  }
  return combos.filter(hasEndcLowband4Rx);
}

/**
 * Filter NR-CA combos to only include those with at least one NR low-band 4Rx MIMO
 */
export function filterNrcaByLowband4Rx(
  combos: ComboNr[],
  enabled: boolean,
): ComboNr[] {
  if (!enabled) {
    return combos;
  }
  return combos.filter(hasNrcaLowband4Rx);
}
