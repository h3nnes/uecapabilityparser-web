import { component$, useSignal, useTask$, useComputed$, type Signal } from '@builder.io/qwik';
import { validateBandwidthFilter } from '~/helpers/bandwidth-filter';
import Button from '../inputs/button';

interface Props {
  filterValue: Signal<string>;
}

export default component$(({ filterValue }: Props) => {
  const filterInput = useSignal('');
  const errorMessage = useComputed$(() => validateBandwidthFilter(filterInput.value));

  // Sync local state with parent state
  useTask$(({ track }) => {
    track(() => filterInput.value);
    const error = errorMessage.value;
    if (!error) {
      filterValue.value = filterInput.value;
    }
  });

  return (
    <div class="mb-4 rounded border border-gray-300 bg-gray-50 p-4">
      <div class="mb-2">
        <label class="mb-1 block text-sm font-semibold text-gray-700">
          Filter by Band:Bandwidth (DL MHz)
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            value={filterInput.value}
            onInput$={(_, el) => {
              filterInput.value = el.value;
            }}
            placeholder="e.g., 78:100, 28:30, 3:30"
            class="flex-1 appearance-none border border-gray-500 bg-white px-3 py-2 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <Button
            type="button"
            label="Clear"
            onClick$={() => {
              filterInput.value = '';
            }}
            disabled={!filterInput.value}
          />
        </div>
      </div>

      {errorMessage.value && (
        <div class="mt-2 text-sm text-red-600">{errorMessage.value}</div>
      )}

      <div class="mt-2 text-xs text-gray-600">
        Enter band:bandwidth pairs separated by commas. Shows combos where each band's
        downlink bandwidth meets or exceeds the specified value.
      </div>
    </div>
  );
});
