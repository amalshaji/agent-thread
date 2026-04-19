import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  executablePath: "/Users/amalshaji/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto("https://agent-thread.amalshaji.workers.dev/t/525v0k0t5t48", { waitUntil: "networkidle0", timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: "/tmp/final1.png" });
await page.evaluate(() => window.scrollTo(0, 2000));
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: "/tmp/final2.png" });

await browser.close();
console.log("Done");
