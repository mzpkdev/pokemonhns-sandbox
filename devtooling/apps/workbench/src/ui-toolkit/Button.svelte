<script lang="ts">
  import type { Snippet } from "svelte"
  import type { HTMLButtonAttributes } from "svelte/elements"

  import { cn } from "../lib/cn.js"

  type Props = HTMLButtonAttributes & {
    children?: Snippet
    class?: string
    variant?: "outline" | "selected" | "solid" | "subtle"
  }

  let {
    children,
    class: className,
    type = "button",
    variant = "outline",
    ...rest
  }: Props = $props()

  const variants = {
    outline:
      "border border-[#8a5b10] bg-white text-[#263e29] hover:bg-[#8a5b10] hover:text-white focus-visible:outline-[#704707]",
    solid:
      "border border-[#8a5b10] bg-[#8a5b10] text-white hover:bg-[#704707] focus-visible:outline-[#704707]",
    selected:
      "border border-atlas-forest bg-atlas-forest text-white hover:bg-[#365332] focus-visible:outline-[#53704e]",
    subtle:
      "border border-transparent text-[#263e29] hover:bg-atlas-forest hover:text-white focus-visible:outline-[#53704e]",
  }
</script>

<button
  {...rest}
  {type}
  class={cn(
    "rounded-md px-3 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    className,
  )}
>
  {@render children?.()}
</button>
