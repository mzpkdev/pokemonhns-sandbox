import { defineOption } from "cmdore"

export default defineOption({
  name: "catalog",
  description: "Render every exterior map plus an atlas-ready catalog.json",
  arity: 0,
})
