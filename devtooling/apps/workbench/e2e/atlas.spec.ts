import { expect, test } from "webanvil/e2e"

test("shows the atlas", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Map atlas" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Regions" })).toBeVisible()
})
