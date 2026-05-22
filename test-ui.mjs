import { chromium } from "playwright";

const BASE = "http://192.168.1.38:3000";
const MASTER_KEY = "sk-dev-master-key-change-me";

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  // Inject auth before any page script runs
  await page.addInitScript((key) => {
    localStorage.setItem("ui_master_key", key);
  }, MASTER_KEY);
  console.log("auth injected via addInitScript");

  // Track navigations and console errors
  page.on("framenavigated", (f) => f.url() !== "about:blank" && console.log("  nav →", f.url()));
  page.on("console", (msg) => msg.type() === "error" && console.log("  console.error:", msg.text()));
  page.on("request", (r) => {
    const url = r.url();
    if (url.includes("/_next/") || url.includes("webpack") || url.includes(".js") || url.includes(".css") || url.includes("favicon") || url.includes("icon") || url.includes("hmr")) return;
    console.log(`  REQ  ${r.method()} ${url.split("?")[0]}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    if (url.includes("/_next/") || url.includes("webpack") || url.includes(".js") || url.includes(".css") || url.includes("favicon") || url.includes("icon") || url.includes("hmr")) return;
    console.log(`  RES  ${r.status()} ${url.split("?")[0]}`);
  });

  console.log("\n=== LANDING PAGE ===");
  // Must register waitForResponse BEFORE goto so we don't miss it
  const agentsResponseP = page.waitForResponse(
    (r) => r.url().includes("/managed_agents/agents") && r.status() === 200,
    { timeout: 20000 },
  ).catch(() => { console.log("warn: agents API never returned 200"); return null; });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await agentsResponseP;
  // Give React one tick to apply state from the 200
  await page.waitForTimeout(500);
  await page.screenshot({ path: "ss-01-landing.png" });
  console.log("screenshot: ss-01-landing.png");

  // Check agent list API
  const agentsRes = await page.evaluate(async () => {
    const r = await fetch("/api/v1/managed_agents/agents", {
      headers: { authorization: "Bearer " + (localStorage.getItem("ui_master_key") ?? "") },
    });
    return { status: r.status, data: await r.json() };
  });
  console.log("agents API status:", agentsRes.status);
  console.log("agent count:", agentsRes.data?.data?.length ?? agentsRes.data?.length ?? "?");
  const firstAgent = agentsRes.data?.data?.[0];
  console.log("first agent name:", firstAgent?.name, "| id:", firstAgent?.id?.slice(0,8));

  // Check agent selector input
  const input = page.locator("input[placeholder='Select agent…']");
  const inputCount = await input.count();
  console.log("\n=== AGENT COMBOBOX ===");
  console.log("selector input found:", inputCount > 0);
  if (inputCount > 0) {
    const val = await input.inputValue();
    console.log("current value:", JSON.stringify(val));

    // Click to open dropdown
    await input.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "ss-02-dropdown-open.png" });
    console.log("screenshot: ss-02-dropdown-open.png");

    const dropdownItems = await page.locator("div.absolute button").count();
    console.log("dropdown item count:", dropdownItems);

    // Type something
    await input.fill("");
    await input.type("a");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "ss-03-typed-a.png" });
    const filtered = await page.locator("div.absolute button").count();
    console.log("items after typing 'a':", filtered);

    // Select first if available
    if (filtered > 0) {
      await page.locator("div.absolute button").first().click();
      await page.waitForTimeout(300);
      const newVal = await input.inputValue();
      console.log("selected agent label:", newVal);
    }
  }

  // Check model strip
  const modelStrip = await page.locator("span.font-mono").first().textContent();
  console.log("model strip:", modelStrip);

  // Try submit flow
  console.log("\n=== SUBMIT FLOW ===");
  const textarea = page.locator("textarea");
  await textarea.fill("hello world");
  const sendBtn = page.locator("button[aria-label='Send']");
  const sendDisabled = await sendBtn.isDisabled();
  console.log("send button disabled:", sendDisabled);
  await page.screenshot({ path: "ss-04-ready-to-send.png" });
  console.log("screenshot: ss-04-ready-to-send.png");

  // Navigate to /agents
  console.log("\n=== /agents PAGE ===");
  await page.goto(`${BASE}/agents`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "ss-05-agents-page.png" });
  console.log("screenshot: ss-05-agents-page.png");
  const agentCards = await page.locator("[data-agent-id], .agent-card, [class*='agent']").count();
  console.log("agent card elements found:", agentCards);

  // Navigate to /sessions
  console.log("\n=== /sessions PAGE ===");
  await page.goto(`${BASE}/sessions`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "ss-06-sessions.png" });
  console.log("screenshot: ss-06-sessions.png");

  await browser.close();
  console.log("\nDone. Screenshots saved.");
}

run().catch((e) => { console.error(e); process.exit(1); });
