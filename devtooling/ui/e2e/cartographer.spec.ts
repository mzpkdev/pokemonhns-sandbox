import { expect, test } from "webanvil/e2e"

test("shows the cartographer", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "Cartographer" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Regions" })).toBeVisible()

  const mapSearch = page.getByRole("combobox", { name: "NAME OR MAP SECTION" })
  await mapSearch.fill("Route29")
  await page.getByRole("option", { name: /Route29/ }).click()
  await expect(page.getByRole("heading", { name: "Route29" })).toBeVisible()

  const exits = page.getByRole("checkbox", { name: "Exits" })
  await expect(exits).not.toBeChecked()
  await page.getByLabel("Interactive cartographer").getByText("Exits", { exact: true }).click()
  await expect(exits).toBeChecked()
})
