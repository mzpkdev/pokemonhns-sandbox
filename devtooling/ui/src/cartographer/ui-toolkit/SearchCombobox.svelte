<script lang="ts">
  import { Combobox, createListCollection } from "@ark-ui/svelte/combobox"

  export type SearchOption = {
    description: string
    label: string
    value: string
  }

  type Props = {
    emptyText: string
    label: string
    options: readonly SearchOption[]
    placeholder: string
    query?: string
    onSelect?: (value: string) => void
  }

  let { emptyText, label, options, placeholder, query = $bindable(""), onSelect }: Props = $props()

  let collection = $derived(createListCollection({ items: options }))

  const handleValueChange = (details: { items: SearchOption[] }): void => {
    const selected = details.items[0]
    if (selected) onSelect?.(selected.value)
  }
</script>

<Combobox.Root
  bind:inputValue={query}
  {collection}
  closeOnSelect
  inputBehavior="autohighlight"
  openOnClick
  selectionBehavior="preserve"
  onValueChange={handleValueChange}
>
  <Combobox.Label class="mb-1 block text-sm font-bold text-tographer-muted">{label}</Combobox.Label>
  <Combobox.Control>
    <Combobox.Input
      class="w-full rounded-md border border-[#9eaf9b] bg-white px-2.5 py-2 text-inherit focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e]"
      {placeholder}
      type="search"
    />
  </Combobox.Control>
  {#if query.trim()}
    <Combobox.Positioner class="z-10 w-full">
      <Combobox.Content
        class="mt-1 max-h-72 overflow-auto rounded-lg border border-[#c5d1c2] bg-white p-1.5 shadow-[0_5px_18px_#56634c1b]"
      >
        {#if options.length > 0}
          <Combobox.List class="grid list-none gap-1.5 p-0">
            {#each options as option (option.value)}
              <Combobox.Item
                class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left outline-none transition hover:bg-[#e5efdc] data-[highlighted]:bg-[#e5efdc] data-[state=checked]:bg-[#d3ebcf]"
                item={option}
              >
                <Combobox.ItemText>{option.label}</Combobox.ItemText>
                <small class="text-right break-words text-tographer-muted"
                  >{option.description}</small
                >
              </Combobox.Item>
            {/each}
          </Combobox.List>
        {:else}
          <Combobox.Empty class="block px-3 py-2 text-sm text-tographer-muted"
            >{emptyText}</Combobox.Empty
          >
        {/if}
      </Combobox.Content>
    </Combobox.Positioner>
  {/if}
</Combobox.Root>
