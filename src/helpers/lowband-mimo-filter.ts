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
 * State of the low-band 4Rx MIMO filter:
 * - 'off': show every combo
 * - 'any': show the combos with at least one low-band component that supports 4Rx
 * - 'all': show the combos where every low-band component supports 4Rx
 *   (e.g. low-band + low-band 4x4 + 4x4)
 */
export type Lowband4RxFilterMode = 'off' | 'any' | 'all';

/** Return the next state of the filter, in the order used by its button. */
export function nextLowband4RxMode(
  mode: Lowband4RxFilterMode,
): Lowband4RxFilterMode {
  switch (mode) {
    case 'off':
      return 'any';
    case 'any':
      return 'all';
    case 'all':
      return 'off';
  }
}

/** Return the label of the filter button for the given state. */
export function lowband4RxFilterLabel(mode: Lowband4RxFilterMode): string {
  switch (mode) {
    case 'any':
      return 'Lowband 4Rx only ON';
    case 'all':
      return 'All lowbands 4x4';
    case 'off':
      return 'Lowband 4Rx only OFF';
  }
}

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
 * Check if every low-band component of an EN-DC combo has 4Rx MIMO DL.
 *
 * Only the components that have a DL configuration are considered: UL-only
 * components (e.g. SUL) don't carry a 4Rx DL capability. A combo without
 * low-band DL components doesn't match.
 */
export function hasEndcAllLowbands4Rx(combo: ComboEnDc): boolean {
  const lteLowbands = combo.componentsLte.filter(
    (component) =>
      component.bwClassDl !== undefined && LTE_LOWBANDS.has(component.band),
  );
  const nrLowbands = combo.componentsNr.filter(
    (component) =>
      component.bwClassDl !== undefined && NR_LOWBANDS.has(component.band),
  );
  return (
    lteLowbands.length + nrLowbands.length > 0 &&
    lteLowbands.every(isLteLowband4Rx) &&
    nrLowbands.every(isNrLowband4Rx)
  );
}

/**
 * Check if every low-band component of an NR-CA combo has 4Rx MIMO DL.
 *
 * Only the components that have a DL configuration are considered: UL-only
 * components (e.g. SUL) don't carry a 4Rx DL capability. A combo without
 * low-band DL components doesn't match.
 */
export function hasNrcaAllLowbands4Rx(combo: ComboNr): boolean {
  const lowbands = combo.components.filter(
    (component) =>
      component.bwClassDl !== undefined && NR_LOWBANDS.has(component.band),
  );
  return lowbands.length > 0 && lowbands.every(isNrLowband4Rx);
}

/**
 * Filter EN-DC combos by low-band 4Rx MIMO.
 *
 * 'any' keeps the combos with at least one low-band 4Rx component, 'all' keeps
 * only the combos where every low-band component is 4Rx.
 */
export function filterEndcByLowband4Rx(
  combos: ComboEnDc[],
  mode: Lowband4RxFilterMode,
): ComboEnDc[] {
  switch (mode) {
    case 'any':
      return combos.filter(hasEndcLowband4Rx);
    case 'all':
      return combos.filter(hasEndcAllLowbands4Rx);
    case 'off':
      return combos;
  }
}

/**
 * Filter NR-CA combos by low-band 4Rx MIMO.
 *
 * 'any' keeps the combos with at least one low-band 4Rx component, 'all' keeps
 * only the combos where every low-band component is 4Rx.
 */
export function filterNrcaByLowband4Rx(
  combos: ComboNr[],
  mode: Lowband4RxFilterMode,
): ComboNr[] {
  switch (mode) {
    case 'any':
      return combos.filter(hasNrcaLowband4Rx);
    case 'all':
      return combos.filter(hasNrcaAllLowbands4Rx);
    case 'off':
      return combos;
  }
}
