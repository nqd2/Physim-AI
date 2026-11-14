import { expect, test } from "@playwright/test";

test("loads all 74 catalog entries and opens a simulation found by search", async ({ page, request }) => {
  const catalog = await request.get("http://127.0.0.1:3000/api/v1/simulations");
  expect(catalog.ok()).toBeTruthy();
  const payload = await catalog.json();
  expect(payload.simulations).toHaveLength(74);
  await page.goto("/library");
  await page.getByPlaceholder("Ví dụ, con lắc").fill("Ohm");
  await page.getByRole("button", { name: /Mở .*Ohm/i }).click();
  await expect(page.getByText("Sẵn sàng", { exact: true })).toBeVisible({ timeout: 35_000 });
});

test("runs a Vietnamese example, completes teach-back and restores a reviewed preset", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở bài Định luật Ohm" }).click();
  await expect(page.getByText("Sẵn sàng", { exact: true })).toBeVisible({ timeout: 35_000 });
  const prediction = page.getByRole("button", { name: "Tăng gấp đôi", exact: true });
  await prediction.scrollIntoViewIfNeeded();
  await prediction.click();
  await page.getByRole("button", { name: "Chạy để kiểm chứng" }).click();
  await expect(page.getByText(/Dòng điện tăng từ 10 mA lên 20 mA/)).toBeVisible();

  await page.getByRole("button", { name: "Bước 2 Giải từng bước" }).click();
  await page.getByRole("button", { name: "Xem gợi ý đầu tiên" }).click();
  await expect(page.getByText(/Viết I = U\/R/)).toBeVisible();

  await page.getByRole("button", { name: "Bước 3 Giải thích lại" }).click();
  await page.getByRole("button", { name: "Đưa mắt xích 1 xuống" }).click();
  await page.getByRole("button", { name: "Đưa mắt xích 2 xuống" }).click();
  await page.getByRole("textbox", { name: "Giải thích bằng một câu" }).fill("Khi điện trở cố định, tăng hiệu điện thế làm dòng điện tăng theo định luật Ohm.");
  await page.getByRole("button", { name: "Đánh giá lời giải thích" }).click();

  await page.getByRole("button", { name: "Bước 4 Thử biến thể" }).click();
  await page.getByRole("textbox", { name: "Dự đoán của bạn" }).fill("5 mA");
  await page.getByRole("button", { name: "Chạy biến thể" }).click();
  await expect(page.getByText(/Dòng điện giảm từ 10 mA còn 5 mA/)).toBeVisible();
  await page.getByRole("button", { name: "Lưu thẻ ôn tập" }).click();
  await expect(page.getByRole("button", { name: "Đã lưu thẻ ôn tập" })).toBeVisible();

  await page.goto("/review");
  await page.getByRole("button", { name: "Mở thẻ Định luật Ohm" }).click();
  await page.getByRole("button", { name: "Xem đáp án" }).click();
  await page.getByRole("button", { name: "5 · Nhớ ngay" }).click();
  await expect(page.getByText("Lịch tiếp theo")).toBeVisible();
  await page.getByRole("button", { name: "Mở thẻ Định luật Ohm" }).click();
  await page.getByRole("button", { name: "Mở lại cấu hình mô phỏng" }).click();
  await expect(page.getByText("Đã áp dụng cấu hình trong phòng thí nghiệm.")).toBeVisible({ timeout: 35_000 });
});

for (const width of [320, 390, 768, 1440]) {
  test(`scanner fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Kiểm chứng bằng thí nghiệm" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chụp đề" })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    await page.getByRole("button", { name: "Đặt 6 V" }).click();
    await expect(page.getByText("20 mA", { exact: true })).toBeVisible();
  });
}
