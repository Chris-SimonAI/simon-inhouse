import { AwsRum, type AwsRumConfig } from "aws-rum-web";

import { Analytics } from "@/lib/analytics/client";

function initRum() {
  const applicationId = process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;
  const identityPoolId = process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID;
  const region = process.env.NEXT_PUBLIC_AWS_REGION;

  if (!applicationId || !identityPoolId || !region) {
    console.error(
      "[aws-rum] missing required env vars: NEXT_PUBLIC_RUM_APP_MONITOR_ID, NEXT_PUBLIC_RUM_IDENTITY_POOL_ID, or NEXT_PUBLIC_AWS_REGION"
    );
    return;
  }

  const config: AwsRumConfig = {
    sessionSampleRate: 1,
    identityPoolId,
    endpoint:
      process.env.NEXT_PUBLIC_RUM_ENDPOINT ??
      `https://dataplane.rum.${region}.amazonaws.com`,
    telemetries: ["performance", "errors", "http"],
    allowCookies: true,
    enableXRay: false,
    recordResourceUrl: false,
  };

  try {
    const awsRum = new AwsRum(applicationId, "1.0.0", region, config);
    (window as typeof window & { AwsRum?: AwsRum }).AwsRum = awsRum;
  } catch (error) {
    console.error("[aws-rum] init failed", error);
  }
}

Analytics.init();
initRum();