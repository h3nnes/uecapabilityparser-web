import { component$, useSignal, useComputed$ } from '@builder.io/qwik';
import type { ComboNr } from '~/@types/uecapabilityparser';

import {
  componentsDlToStr,
  componentsUlToStr,
  componentsMimoDlToStr,
  componentsMimoUlToStr,
  componentsModDlToStr,
  componentsModUlToStr,
  componentsBwDlToStr,
  componentsBwUlToStr,
  componentsScsDlToStr,
  componentsScsUlToStr,
  bcsToStr,
  ulTxSwitchToStr,
} from '~/helpers/combos';
import {
  parseBandwidthFilter,
  filterCombosByBandwidth,
} from '~/helpers/bandwidth-filter';
import { filterNrcaByLowband4Rx } from '~/helpers/lowband-mimo-filter';
import ComboTable from '~/components/table/combo-table';
import NrBandwidthFilter from '~/components/filters/NrBandwidthFilter';

interface Props {
  combos?: ComboNr[];
  title?: string;
  open?: boolean;
}

export default component$((props: Props) => {
  const { combos, title, open } = props;

  if (combos === undefined || combos.length == 0) {
    return <></>;
  }

  // Bandwidth filter state - shared with filter component
  const bandwidthFilterText = useSignal('');

  // Low-band 4Rx MIMO filter state
  const lowband4RxFilterEnabled = useSignal(false);

  // Apply filters to combos (both bandwidth and lowband 4Rx filters)
  const filteredCombos = useComputed$(() => {
    const criteria = parseBandwidthFilter(bandwidthFilterText.value);
    let result = filterCombosByBandwidth(combos, criteria);
    result = filterNrcaByLowband4Rx(result, lowband4RxFilterEnabled.value);
    return result;
  });

  const headers = [
    'NR DL',
    'MIMO DL',
    'MOD DL (QAM)',
    'SCS DL (kHz)',
    'BW DL (MHz)',
    'NR UL',
    'MIMO UL',
    'MOD UL (QAM)',
    'SCS UL (kHz)',
    'BW UL (MHz)',
    'UL TX Switch',
    'BCS',
  ];

  // check if any has ulTxSwitch not null/empty
  const supportUplinkTxSwitch = combos.some(
    ({ uplinkTxSwitch }) => (uplinkTxSwitch?.length ?? 0) > 0,
  );

  const data: string[][] = [];
  for (let i = 0; i < headers.length; i++) {
    data.push([]);
  }

  filteredCombos.value.forEach(({ components, bcs, uplinkTxSwitch }) => {
    let i = 0;
    data[i++].push(componentsDlToStr(components, true));
    data[i++].push(componentsMimoDlToStr(components, true));
    data[i++].push(componentsModDlToStr(components, true));
    data[i++].push(componentsScsDlToStr(components));
    data[i++].push(componentsBwDlToStr(components));
    data[i++].push(componentsUlToStr(components, true));
    data[i++].push(componentsMimoUlToStr(components, true));
    data[i++].push(componentsModUlToStr(components, true));
    data[i++].push(componentsScsUlToStr(components));
    data[i++].push(componentsBwUlToStr(components));
    data[i++].push(ulTxSwitchToStr(uplinkTxSwitch, supportUplinkTxSwitch));
    data[i++].push(bcsToStr(bcs));
  });

  // Show filter count if any filter is active
  const showFilterCount =
    bandwidthFilterText.value.trim() !== '' || lowband4RxFilterEnabled.value;
  const filterCountText = showFilterCount
    ? ` (Showing ${filteredCombos.value.length} of ${combos.length} combos)`
    : '';

  return (
    <details open={open ?? false}>
      <summary class="mt-10 text-xl font-bold">
        {title}
        {filterCountText}
      </summary>
      <NrBandwidthFilter filterValue={bandwidthFilterText} />
      <ComboTable
        title={undefined}
        hideEmpty={true}
        headers={headers}
        data={data}
        pagination={filteredCombos.value && filteredCombos.value.length > 25}
        coloredBands={true}
        noSpoiler={true}
        lowband4RxFilter={lowband4RxFilterEnabled}
      />
    </details>
  );
});
