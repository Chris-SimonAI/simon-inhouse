import path from "node:path";
import { ensureDir, nowIso, writeJson } from "./probe-utils";
import { runSliceProbe, type SliceProbeResult } from "./slice-probe";

const targets = [
  {
    url: "https://www.samopizzamenu.com/",
    isWhiteLabel: true,
  },
  {
    url: "https://slicelife.com/restaurants/ca/santa-monica/90405/samo-pizza/menu",
    isWhiteLabel: false,
  },
] as const;

async function main() {
  const outputDir = path.join(process.cwd(), "probe-results", "slice");
  const screenshotDir = path.join(outputDir, "screenshots");
  await ensureDir(screenshotDir);

  const results: SliceProbeResult[] = [];

  for (const target of targets) {
    const result = await runSliceProbe({
      url: target.url,
      isWhiteLabel: target.isWhiteLabel,
      runs: 3,
      screenshotDir,
    });
    results.push(result);
  }

  const payload = {
    generatedAt: nowIso(),
    results,
  };

  const outPath = path.join(outputDir, "scorecard.json");
  await writeJson(outPath, payload);

  // Print for quick copy/paste.
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
