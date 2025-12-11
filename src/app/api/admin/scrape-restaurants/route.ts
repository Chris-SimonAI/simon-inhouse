import { NextRequest, NextResponse } from "next/server";
import { createError, createSuccess } from "@/lib/utils";
import { sendScraperJob, type ScraperJobPayload } from "@/lib/sqs";
import { validateApiKey } from "@/utils/api-key-validation";

export async function POST(request: NextRequest) {
  try {
    // API key guard
    if (!validateApiKey(request.headers.get("x-api-key") || "")) {
      return NextResponse.json(createError("UNAUTHORIZED"), { status: 401 });
    }

    const body = await request.json();

    const restaurantMode: 'new' | 'existing' | 'stock-availability' = body.restaurantMode;

    // Validate restaurantMode
    if (!["new", "existing", "stock-availability"].includes(restaurantMode)) {
      return NextResponse.json(
        createError('restaurantMode must be "new", "existing", or "stock-availability"'),
        { status: 400 }
      );
    }

    // Validation for URLs and hotelID depends on mode
    if (restaurantMode === "new" || restaurantMode === "existing") {
      if (!body.urls) {
        return NextResponse.json(
          createError("urls is required (string or array of strings)"),
          { status: 400 }
        );
      }
      if (!body.hotelID) {
        return NextResponse.json(
          createError("hotelID is required"),
          { status: 400 }
        );
      }
      // Validate URLs
      const urls = Array.isArray(body.urls) ? body.urls : [body.urls];
      for (const url of urls) {
        if (typeof url !== "string" || !url.trim()) {
          return NextResponse.json(
            createError("All URLs must be non-empty strings"),
            { status: 400 }
          );
        }
        // Basic URL validation
        try {
          new URL(url);
        } catch {
          return NextResponse.json(
            createError(`Invalid URL format: ${url}`),
            { status: 400 }
          );
        }
      }
      // Validate hotelID is a valid string (will be converted to number by handler)
      if (typeof body.hotelID !== "string" || !body.hotelID.trim()) {
        return NextResponse.json(
          createError("hotelID must be a non-empty string"),
          { status: 400 }
        );
      }
    }

    // Validate restaurantGuid if restaurantMode is "existing"
    if (restaurantMode === "existing" && !body.restaurantGuid) {
      return NextResponse.json(
        createError("restaurantGuid is required when restaurantMode is 'existing'"),
        { status: 400 }
      );
    }

    // Prepare payload
    let payload: ScraperJobPayload;
    if (restaurantMode === "stock-availability") {
      // In stock-availability mode, urls are not required; hotelID and restaurantGuid are optional
      payload = {
        restaurantMode,
        restaurantGuid: body.restaurantGuid,
        // If provided, pass hotelID through (validated as string only when present)
        hotelID: typeof body.hotelID === "string" && body.hotelID.trim() ? body.hotelID : undefined,
      };
    } else {
      payload = {
        urls: Array.isArray(body.urls) ? body.urls : [body.urls],
        hotelID: body.hotelID,
        restaurantMode,
        restaurantGuid: body.restaurantGuid,
      };
    }

    // Send to SQS
    const result = await sendScraperJob(payload);

    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(createSuccess({
      message: "Scraper job queued successfully",
      ...result.data,
    }));
  } catch (error) {
    console.error("Error in POST /api/admin/scrape-restaurants:", error);
    return NextResponse.json(
      createError("Internal server error"),
      { status: 500 }
    );
  }
}

