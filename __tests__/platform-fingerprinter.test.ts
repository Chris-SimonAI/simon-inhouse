import { describe, expect, it } from "vitest";
import { fingerprintOrderingPlatformFromHtml } from "@/lib/restaurant-discovery/platform-fingerprinter-core";

describe("fingerprintOrderingPlatformFromHtml", () => {
  it("detects providers from script and iframe sources", () => {
    const html = `
      <html>
        <head>
          <script src="https://www.toasttab.com/static/app.js"></script>
        </head>
        <body>
          <iframe src="https://www.toasttab.com/local/order/somewhere"></iframe>
        </body>
      </html>
    `;

    const fingerprint = fingerprintOrderingPlatformFromHtml({
      websiteUrl: "https://www.example.com",
      html,
    });

    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.primary.id).toBe("toast");
    expect(fingerprint?.signals.length).toBeGreaterThan(0);
  });

  it("detects Slice from powered-by text markers", () => {
    const html = `
      <html>
        <body>
          <div>By opting in, you acknowledge and agree that Slice may deliver...</div>
        </body>
      </html>
    `;

    const fingerprint = fingerprintOrderingPlatformFromHtml({
      websiteUrl: "https://www.order-example.com",
      html,
    });

    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.primary.id).toBe("slice");
  });
});
