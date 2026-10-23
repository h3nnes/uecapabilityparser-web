import { $, component$, useComputed$, useSignal } from '@builder.io/qwik';
import type {
  Capabilities,
  ComboLte,
  ComboEnDc,
  ComboNr,
  ComboNrDc,
} from '~/@types/uecapabilityparser';
import {
  parseComboString,
  validateComboType,
  matchCombo,
  type ComboType,
  type SearchCombo,
} from '~/helpers/combo-search';
import SelectInput from '../inputs/select-input';

import Lteca from '../table/lteca';
import Endc from '../table/endc';
import Nrca from '../table/nrca';
import Nrdc from '../table/nrdc';

interface Props {
  capabilities?: Capabilities;
}

export default component$(({ capabilities }: Props) => {
  const comboType = useSignal<ComboType>('LTE');
  const searchString = useSignal('');
  const error = useSignal<string | null>(null);
  const searchedType = useSignal<ComboType>('LTE');
  const searchedCombo = useSignal<SearchCombo | null>(null);
  const hasSearched = useSignal(false);

  const typeOptions = [
    { label: 'LTE', value: 'LTE' },
    { label: 'ENDC', value: 'ENDC' },
    { label: 'NRCA', value: 'NRCA' },
    { label: 'NRDC', value: 'NRDC' },
  ];

  const handleSearch = $(() => {
    const parseResult = parseComboString(searchString.value);
    if (!parseResult.success) {
      error.value = parseResult.error;
      searchedCombo.value = null;
      hasSearched.value = true;
      return;
    }

    const typeError = validateComboType(parseResult.combo, comboType.value);
    if (typeError) {
      error.value = typeError;
      searchedCombo.value = null;
      hasSearched.value = true;
      return;
    }

    error.value = null;
    searchedType.value = comboType.value;
    searchedCombo.value = parseResult.combo;
    hasSearched.value = true;
  });

  const filteredCombos = useComputed$<
    (ComboLte | ComboEnDc | ComboNr | ComboNrDc)[] | null
  >(() => {
    if (!hasSearched.value || error.value || !searchedCombo.value) return null;
    const search = searchedCombo.value;
    const type = searchedType.value;
    const caps = capabilities;
    if (!caps) return null;

    switch (type) {
      case 'LTE':
        return caps.lteca?.filter((c) => matchCombo(search, c, 'LTE')) ?? [];
      case 'ENDC':
        return caps.endc?.filter((c) => matchCombo(search, c, 'ENDC')) ?? [];
      case 'NRCA':
        return caps.nrca?.filter((c) => matchCombo(search, c, 'NRCA')) ?? [];
      case 'NRDC':
        return caps.nrdc?.filter((c) => matchCombo(search, c, 'NRDC')) ?? [];
    }
  });

  return (
    <details open={false}>
      <summary class="mt-10 text-xl font-bold">Search specific combos</summary>

      <form
        onSubmit$={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        class="mt-4 flex flex-wrap items-end gap-2"
      >
        <SelectInput
          label="Combo type"
          options={typeOptions}
          selectedValue={comboType.value}
          onInput$={(value) => {
            comboType.value = value as ComboType;
          }}
        />
        <div class="flex min-w-[24rem] flex-1 flex-col">
          <label class="my-2">Search string</label>
          <input
            type="text"
            value={searchString.value}
            placeholder="e.g. 28a2a+3a4+7c44a+20a2"
            onInput$={(_, el) => {
              searchString.value = el.value;
            }}
            class="w-full appearance-none border-2 border-solid border-gray-500 bg-white p-2 placeholder:text-gray-400 focus:outline-none focus:ring focus:ring-gray-400"
          />
        </div>
        <div class="w-32 flex-shrink-0">
          <label class="my-2 invisible">Search</label>
          <button
            type="submit"
            class="w-full bg-black p-2 text-lg text-white focus:outline-none focus:ring focus:ring-gray-400"
          >
            Search
          </button>
        </div>
      </form>

      {error.value && <p class="mt-2 text-red-600">{error.value}</p>}

      {hasSearched.value && !error.value && filteredCombos.value !== null && (
        <div class="mt-4">
          {filteredCombos.value.length === 0 ? (
            <p>No matches found</p>
          ) : (
            <>
              <p class="mb-2">
                Found {filteredCombos.value.length} matching combo(s)
              </p>
              {searchedType.value === 'LTE' && (
                <Lteca
                  combos={filteredCombos.value as ComboLte[]}
                  coloredBands={true}
                  title="Search Results (LTE CA)"
                  noSearch={true}
                  open={true}
                />
              )}
              {searchedType.value === 'ENDC' && (
                <Endc
                  combos={filteredCombos.value as ComboEnDc[]}
                  title="Search Results (EN-DC)"
                  open={true}
                />
              )}
              {searchedType.value === 'NRCA' && (
                <Nrca
                  combos={filteredCombos.value as ComboNr[]}
                  title="Search Results (NR CA)"
                  open={true}
                />
              )}
              {searchedType.value === 'NRDC' && (
                <Nrdc
                  combos={filteredCombos.value as ComboNrDc[]}
                  title="Search Results (NR DC)"
                  open={true}
                />
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
});
