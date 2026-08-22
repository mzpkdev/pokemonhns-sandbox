import { expect, test } from "webanvil/e2e"

test("shows the cartographer", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("link", { name: "Cartographer" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Regions" })).toBeVisible()

  const mapSearch = page.getByRole("combobox", { name: "Name or map section" })
  await mapSearch.fill("Route29")
  await page.getByRole("option", { name: /Route29/ }).click()
  await expect(page.getByRole("heading", { name: "Route29" })).toBeVisible()

  const exits = page.getByRole("checkbox", { name: "Exits" })
  await expect(exits).not.toBeChecked()
  await page.getByLabel("Interactive cartographer").getByText("Exits", { exact: true }).click()
  await expect(exits).toBeChecked()

  const objects = page.getByRole("checkbox", { name: "Objects" })
  await expect(objects).not.toBeChecked()
  await page.getByLabel("Interactive cartographer").getByText("Objects", { exact: true }).click()
  await expect(objects).toBeChecked()
  const trainers = page.getByRole("checkbox", { name: /Trainer/ })
  await expect(trainers).toBeChecked()
  await page
    .getByLabel("Object filters")
    .getByText(/Trainer/)
    .click()
  await expect(trainers).not.toBeChecked()

  await mapSearch.fill("Route15")
  await page.getByRole("option", { name: /Route15/ }).click()
  await expect(page.getByRole("heading", { name: "Route15" })).toBeVisible()
  await page.getByRole("button", { name: /OBJ_EVENT_GFX_ITEM_BALL/ }).click()
  await expect(page.getByText("Object inspector")).toBeVisible()
  await expect(page.getByText("Gives PP Up")).toBeVisible()
  await expect(page.getByText("Route15_EventScript_PPup")).toBeVisible()
  await expect(page.getByText("Sprite", { exact: true })).toBeVisible()

  await mapSearch.fill("Route32")
  await page.getByRole("option", { name: /Route32/ }).click()
  await expect(page.getByRole("checkbox", { name: /Topology diagnostics/ })).toHaveCount(0)

  const atlasOverlaps = page.getByRole("checkbox", { name: /Overlaps/ })
  await expect(atlasOverlaps).toBeVisible()
  await page
    .getByLabel("Interactive cartographer")
    .getByText(/Overlaps/)
    .click()
  await expect(atlasOverlaps).toBeChecked()
  await expect(page.getByLabel("Overlap details")).toBeVisible()
})
