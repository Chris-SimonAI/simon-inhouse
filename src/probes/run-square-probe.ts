import path from "node:path";
import { ensureDir, nowIso, writeJson } from "./probe-utils";
import { runSquareOnlineProbe, type SquareOnlineProbeResult } from "./square-probe";

async function main() {
  const url = "https://urban-skillet-santa-monica.square.site/";

  const outputDir = path.join(process.cwd(), "probe-results", "square");
  const screenshotDir = path.join(outputDir, "screenshots");
  await ensureDir(screenshotDir);

  const networkLogPath = path.join(outputDir, "network-log.json");

  const result = await runSquareOnlineProbe({
    url,
    runs: 3,
    screenshotDir,
    networkLogPath,
  });

  const payload: { generatedAt: string; result: SquareOnlineProbeResult } = {
    generatedAt: nowIso(),
    result,
  };

  const outPath = path.join(outputDir, "scorecard.json");
  await writeJson(outPath, payload);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

