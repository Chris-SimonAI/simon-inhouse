import { initDemoDatabase } from "./demo-init";

let isInitialized = false;

export async function ensureDemoData() {
  if (isInitialized) return;
  await initDemoDatabase();
  isInitialized = true;
}
