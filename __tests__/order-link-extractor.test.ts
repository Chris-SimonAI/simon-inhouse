import { describe, expect, it } from "vitest";
import { extractOrderingLinksFromWebsiteHtml } from "@/lib/restaurant-discovery/order-link-extractor-core";

describe("extractOrderingLinksFromWebsiteHtml", () => {
  it("prefers obvious ordering links and known providers", () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="https://www.toasttab.com/local/order/fat-tomato">Order Online</a>
          <a href="https://instagram.com/fattomato">Instagram</a>
          <a href="/catering">Catering</a>
        </body>
      </html>
    `;

    const results = extractOrderingLinksFromWebsiteHtml({
      websiteUrl: "https://www.example.com",
      html,
      maxCandidates: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toContain("toasttab.com");
    expect(results[0]?.platform.id).toBe("toast");
  });

  it("dedupes and respects maxCandidates", () => {
    const html = `
      <html>
        <body>
          <a href="https://www.chownow.com/order/123">Order</a>
          <a href="https://www.chownow.com/order/123">Order again</a>
          <a href="https://www.toasttab.com/local/order/xyz">Toast order</a>
        </body>
      </html>
    `;

    const results = extractOrderingLinksFromWebsiteHtml({
      websiteUrl: "https://www.example.com",
      html,
      maxCandidates: 1,
    });

    expect(results).toHaveLength(1);
  });
});
