import { expect, test } from "webanvil/e2e"

test("shows the atlas", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Map atlas" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Regions" })).toBeVisible()

  const mapSearch = page.getByRole("combobox", { name: "Source name or map section" })
  await mapSearch.fill("Route29")
  await page.getByRole("option", { name: /Route29/ }).click()
  await expect(page.getByRole("heading", { name: "Route29" })).toBeVisible()

  const exits = page.getByRole("checkbox", { name: "Exits" })
  await expect(exits).not.toBeChecked()
  await page.getByText("Exits", { exact: true }).click()
  await expect(exits).toBeChecked()
})
