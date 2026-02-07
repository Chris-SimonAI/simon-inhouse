'use server';

import 'server-only';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  dineInRestaurants,
  hotels,
  menuGroups,
  menuItems,
  menus,
} from '@/db/schemas';
import { createError, createSuccess } from '@/lib/utils';
import { compileCanonicalOrderRequest } from '@/lib/orders/canonical-order-compiler-server';
import {
  chooseBestRestaurantGuid,
  parseOrderRequestLines,
  scoreMenuCandidate,
  toMatchReason,
} from '@/lib/orders/order-compiler-matcher';

export const runtime = 'nodejs';

const runOrderCompilerPreviewSchema = z.object({
  message: z.string().min(2).max(600),
  restaurantGuid: z.string().uuid().optional(),
  maxCandidates: z.number().int().min(1).max(5).default(3),
});

export interface OrderCompilerRestaurantOption {
  restaurantGuid: string;
  restaurantName: string;
  hotelName: string | null;
}

interface IndexedMenuItem {
  restaurantGuid: string;
  restaurantName: string;
  menuItemGuid: string;
  menuItemName: string;
  menuItemDescription: string | null;
}

interface CandidateMatch {
  restaurantGuid: string;
  restaurantName: string;
  menuItemGuid: string;
  menuItemName: string;
  score: number;
  reason: string;
}

export async function getOrderCompilerRestaurants() {
  try {
    const restaurants = await db
      .select({
        restaurantGuid: dineInRestaurants.restaurantGuid,
        restaurantName: dineInRestaurants.name,
        hotelName: hotels.name,
      })
      .from(dineInRestaurants)
      .leftJoin(hotels, eq(dineInRestaurants.hotelId, hotels.id))
      .where(eq(dineInRestaurants.status, 'approved'));

    return createSuccess(restaurants);
  } catch (error) {
    console.error('Error in getOrderCompilerRestaurants:', error);
    return createError('Failed to load restaurants');
  }
}

export async function runOrderCompilerPreview(input: unknown) {
  const parsedInput = runOrderCompilerPreviewSchema.safeParse(input);
  if (!parsedInput.success) {
    return createError('Invalid compiler request', parsedInput.error.flatten());
  }

  const request = parsedInput.data;

  try {
    const indexedMenuItems = await getIndexedMenuItems(request.restaurantGuid);
    if (indexedMenuItems.length === 0) {
      return createError('No approved menu items found for this scope');
    }

    const parsedLines = parseOrderRequestLines(request.message);
    if (parsedLines.length === 0) {
      return createError('Could not parse any orderable items from input');
    }

    const requestMatches = parsedLines.map((line) => {
      const candidates = rankCandidatesForLine(
        line,
        indexedMenuItems,
        request.maxCandidates,
      );

      return {
        requestLine: line,
        candidates,
      };
    });

    const selectedRestaurantGuid =
      request.restaurantGuid ??
      chooseBestRestaurantGuid(
        requestMatches.map((match) =>
          match.candidates.map((candidate) => ({
            restaurantGuid: candidate.restaurantGuid,
            score: candidate.score,
          })),
        ),
      );

    if (!selectedRestaurantGuid) {
      return createError('No restaurant candidates matched your input');
    }

    const selectedRestaurantName =
      requestMatches
        .flatMap((match) => match.candidates)
        .find((candidate) => candidate.restaurantGuid === selectedRestaurantGuid)
        ?.restaurantName ?? null;

    const selectedMatches = requestMatches.map((match) => {
      const selectedCandidate = match.candidates.find(
        (candidate) => candidate.restaurantGuid === selectedRestaurantGuid,
      );

      return {
        requestText: match.requestLine.raw,
        normalizedRequest: match.requestLine.normalized,
        quantity: match.requestLine.quantity,
        selectedCandidate: selectedCandidate ?? null,
        candidates: match.candidates,
      };
    });

    const draftItems = selectedMatches
      .filter((match) => match.selectedCandidate !== null)
      .map((match) => ({
        menuItemGuid: match.selectedCandidate!.menuItemGuid,
        quantity: match.quantity,
        selectedModifiers: {} as Record<string, string[]>,
      }));

    const unmatchedRequests = selectedMatches
      .filter((match) => match.selectedCandidate === null)
      .map((match) => match.requestText);

    let compile:
      | {
          status: 'ready_to_execute' | 'needs_user_input' | 'unfulfillable';
          subtotal: number;
          itemCount: number;
          issues: Array<{
            code: string;
            message: string;
            severity: 'needs_user_input' | 'unfulfillable';
          }>;
        }
      | null = null;
    let compileError: string | null = null;

    if (draftItems.length > 0) {
      const compileResult = await compileCanonicalOrderRequest(
        selectedRestaurantGuid,
        draftItems,
      );

      if (!compileResult.ok) {
        compileError = compileResult.message;
      } else {
        compile = {
          status: compileResult.data.status,
          subtotal: compileResult.data.subtotal,
          itemCount: compileResult.data.items.length,
          issues: compileResult.data.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            severity: issue.severity,
          })),
        };
      }
    }

    const searchStats = {
      menuItemsScanned: indexedMenuItems.length,
      requestLinesParsed: parsedLines.length,
      restaurantsConsidered: new Set(
        indexedMenuItems.map((item) => item.restaurantGuid),
      ).size,
    };

    return createSuccess({
      input: {
        message: request.message,
        restaurantGuid: request.restaurantGuid ?? null,
      },
      selectedRestaurant: {
        restaurantGuid: selectedRestaurantGuid,
        restaurantName: selectedRestaurantName,
      },
      matches: selectedMatches,
      unmatchedRequests,
      canonicalDraft: {
        restaurantGuid: selectedRestaurantGuid,
        items: draftItems,
      },
      compile,
      compileError,
      searchStats,
    });
  } catch (error) {
    console.error('Error in runOrderCompilerPreview:', error);
    return createError('Failed to run order compiler preview');
  }
}

async function getIndexedMenuItems(
  restaurantGuid?: string,
): Promise<IndexedMenuItem[]> {
  const baseConditions = [
    eq(dineInRestaurants.status, 'approved'),
    eq(menus.status, 'approved'),
    eq(menuGroups.status, 'approved'),
    eq(menuItems.status, 'approved'),
    eq(menuItems.isAvailable, true),
  ] as const;

  const whereClause = restaurantGuid
    ? and(
        ...baseConditions,
        eq(dineInRestaurants.restaurantGuid, restaurantGuid),
      )
    : and(...baseConditions);

  return db
    .select({
      restaurantGuid: dineInRestaurants.restaurantGuid,
      restaurantName: dineInRestaurants.name,
      menuItemGuid: menuItems.menuItemGuid,
      menuItemName: menuItems.name,
      menuItemDescription: menuItems.description,
    })
    .from(menuItems)
    .innerJoin(menuGroups, eq(menuItems.menuGroupId, menuGroups.id))
    .innerJoin(menus, eq(menuGroups.menuId, menus.id))
    .innerJoin(dineInRestaurants, eq(menus.restaurantId, dineInRestaurants.id))
    .where(whereClause);
}

function rankCandidatesForLine(
  requestLine: {
    raw: string;
    normalized: string;
    quantity: number;
    tokens: string[];
  },
  indexedItems: IndexedMenuItem[],
  maxCandidates: number,
): CandidateMatch[] {
  return indexedItems
    .map((item) => {
      const score = scoreMenuCandidate(
        requestLine,
        item.menuItemName,
        item.menuItemDescription,
      );
      return {
        restaurantGuid: item.restaurantGuid,
        restaurantName: item.restaurantName,
        menuItemGuid: item.menuItemGuid,
        menuItemName: item.menuItemName,
        score: score.score,
        reason: toMatchReason(score),
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.menuItemName.localeCompare(b.menuItemName);
    })
    .slice(0, maxCandidates);
}
