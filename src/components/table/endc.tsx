import { component$, useSignal, useComputed$ } from '@builder.io/qwik';
import type { ComboEnDc } from '~/@types/uecapabilityparser';

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
} from '~/helpers/combos';
import { filterEndcByLowband4Rx } from '~/helpers/lowband-mimo-filter';
import ComboTable from '~/components/table/combo-table';
interface Props {
  combos?: ComboEnDc[];
  title?: string;
  open?: boolean;
}

export default component$((props: Props) => {
  const { combos, title, open } = props;

  if (combos === undefined || combos.length == 0) {
    return <></>;
  }

  // Low-band 4Rx MIMO filter state
  const lowband4RxFilterEnabled = useSignal(false);

  // Apply filter to combos
  const filteredCombos = useComputed$(() => {
    return filterEndcByLowband4Rx(combos, lowband4RxFilterEnabled.value);
  });

  const headers = [
    'LTE DL',
    'LTE MIMO DL',
    'LTE MOD DL (QAM)',
    'NR DL',
    'NR MIMO DL',
    'NR MOD DL (QAM)',
    'NR SCS DL (kHz)',
    'NR BW DL (MHz)',
    'LTE UL',
    'LTE MIMO UL',
    'LTE Mod UL (QAM)',
    'NR UL',
    'NR MIMO UL',
    'NR MOD UL (QAM)',
    'NR SCS UL (kHz)',
    'NR BW UL (MHz)',
    'BCS LTE',
    'BCS NR',
    'BCS INTRA ENDC',
  ];

  const data: string[][] = [];
  for (let i = 0; i < headers.length; i++) {
    data.push([]);
  }

  filteredCombos.value.forEach(
    ({ componentsLte, componentsNr, bcsEutra, bcsNr, bcsIntraEndc }) => {
      let i = 0;
      data[i++].push(componentsDlToStr(componentsLte));
      data[i++].push(componentsMimoDlToStr(componentsLte));
      data[i++].push(componentsModDlToStr(componentsLte));
      data[i++].push(componentsDlToStr(componentsNr, true));
      data[i++].push(componentsMimoDlToStr(componentsNr, true));
      data[i++].push(componentsModDlToStr(componentsNr, true));
      data[i++].push(componentsScsDlToStr(componentsNr));
      data[i++].push(componentsBwDlToStr(componentsNr));
      data[i++].push(componentsUlToStr(componentsLte));
      data[i++].push(componentsMimoUlToStr(componentsLte));
      data[i++].push(componentsModUlToStr(componentsLte));
      data[i++].push(componentsUlToStr(componentsNr, true));
      data[i++].push(componentsMimoUlToStr(componentsNr, true));
      data[i++].push(componentsModUlToStr(componentsNr, true));
      data[i++].push(componentsScsUlToStr(componentsNr));
      data[i++].push(componentsBwUlToStr(componentsNr));
      data[i++].push(bcsToStr(bcsEutra));
      data[i++].push(bcsToStr(bcsNr));
      data[i++].push(bcsToStr(bcsIntraEndc));
    },
  );

  // Show filter count if filter is active
  const showFilterCount = lowband4RxFilterEnabled.value;
  const filterCountText = showFilterCount
    ? ` (Showing ${filteredCombos.value.length} of ${combos.length} combos)`
    : '';

  return (
    <details open={open ?? false}>
      <summary class="mt-10 text-xl font-bold">
        {title}
        {filterCountText}
      </summary>
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
