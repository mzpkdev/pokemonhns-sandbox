import { defineOption } from "cmdore"

export default defineOption({
  name: "repo",
  description: "Pokemon HnS source tree; defaults to the nearest ancestor",
  hint: "path",
  arity: 1,
})
