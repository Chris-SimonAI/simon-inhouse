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
import { compileCanonicalOrderRequest } from '@/lib/orders/canonical-order-compiler-server';
import {
  assessCandidateSelectionQuality,
  chooseBestRestaurantGuid,
  isLikelyModifierOnlyRequestLine,
  type CandidateConfidenceLevel,
  type ParsedOrderRequestLine,
  parseOrderRequestLines,
  scoreMenuCandidate,
  toMatchReason,
} from '@/lib/orders/order-compiler-matcher';
import { type OrderCompilerRestaurantOption } from '@/lib/orders/order-compiler-types';
import { createError, createSuccess } from '@/lib/utils';

const runOrderCompilerPreviewSchema = z.object({
  message: z.string().min(2).max(600),
  restaurantGuid: z.string().uuid().optional(),
  maxCandidates: z.number().int().min(1).max(5).default(3),
});

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

type MatchResolution = 'selected' | 'ambiguous' | 'modifier_only' | 'unmatched';

interface ResolvedMatch {
  requestText: string;
  normalizedRequest: string;
  quantity: number;
  resolution: MatchResolution;
  resolutionReason: string | null;
  confidence: {
    level: CandidateConfidenceLevel;
    topScore: number | null;
    scoreGap: number | null;
  } | null;
  selectedCandidate: CandidateMatch | null;
  candidates: CandidateMatch[];
}

interface CompileIssue {
  code: string;
  message: string;
  severity: 'needs_user_input' | 'unfulfillable';
}

export async function getOrderCompilerRestaurants() {
  try {
    const restaurants: OrderCompilerRestaurantOption[] = await db
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

    const requestMatches = parsedLines.map((requestLine) => {
      const modifierOnly = isLikelyModifierOnlyRequestLine(requestLine);
      if (modifierOnly) {
        return {
          requestLine,
          candidates: [] as CandidateMatch[],
          modifierOnly: true,
        };
      }

      const candidates = rankCandidatesForLine(
        requestLine,
        indexedMenuItems,
        request.maxCandidates,
      );

      return {
        requestLine,
        candidates,
        modifierOnly: false,
      };
    });

    const selectedRestaurantGuid =
      request.restaurantGuid ??
      chooseBestRestaurantGuid(
        requestMatches.map((match) =>
          match.modifierOnly
            ? []
            : match.candidates.map((candidate) => ({
                restaurantGuid: candidate.restaurantGuid,
                score: candidate.score,
              })),
        ),
      );

    if (!selectedRestaurantGuid) {
      return createError('No restaurant candidates matched your input');
    }

    const selectedRestaurantName =
      indexedMenuItems.find(
        (item) => item.restaurantGuid === selectedRestaurantGuid,
      )?.restaurantName ?? null;

    const menuItemNameByGuid = new Map(
      indexedMenuItems.map((item) => [item.menuItemGuid, item.menuItemName]),
    );

    const resolvedMatches: ResolvedMatch[] = requestMatches.map((match) =>
      resolveRequestLineMatch(match, selectedRestaurantGuid),
    );

    const draftItems = resolvedMatches.reduce<
      Array<{
        menuItemGuid: string;
        menuItemName: string;
        quantity: number;
        selectedModifiers: Record<string, string[]>;
      }>
    >((accumulator, match) => {
      if (match.resolution !== 'selected' || match.selectedCandidate === null) {
        return accumulator;
      }

      accumulator.push({
        menuItemGuid: match.selectedCandidate.menuItemGuid,
        menuItemName:
          menuItemNameByGuid.get(match.selectedCandidate.menuItemGuid) ??
          match.selectedCandidate.menuItemName,
        quantity: match.quantity,
        selectedModifiers: {},
      });

      return accumulator;
    }, []);

    const inputResolutionIssues = buildInputResolutionIssues(resolvedMatches);

    const unresolvedRequests = resolvedMatches
      .filter((match) => match.resolution !== 'selected')
      .map((match) => match.requestText);

    let compile:
      | {
          status: 'ready_to_execute' | 'needs_user_input' | 'unfulfillable';
          subtotal: number;
          itemCount: number;
          issues: CompileIssue[];
        }
      | null = null;
    let compileError: string | null = null;

    if (draftItems.length > 0) {
      const compileResult = await compileCanonicalOrderRequest(
        selectedRestaurantGuid,
        draftItems.map((item) => ({
          menuItemGuid: item.menuItemGuid,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
        })),
      );

      if (!compileResult.ok) {
        compileError = compileResult.message;
      } else {
        const canonicalIssues: CompileIssue[] = compileResult.data.issues.map(
          (issue) => ({
            code: issue.code,
            message: issue.message,
            severity: issue.severity,
          }),
        );
        const combinedIssues = [...canonicalIssues, ...inputResolutionIssues];

        const hasUnfulfillable = combinedIssues.some(
          (issue) => issue.severity === 'unfulfillable',
        );
        const hasNeedsUserInput = combinedIssues.some(
          (issue) => issue.severity === 'needs_user_input',
        );

        const status = hasUnfulfillable
          ? 'unfulfillable'
          : hasNeedsUserInput
            ? 'needs_user_input'
            : compileResult.data.status;

        compile = {
          status,
          subtotal: compileResult.data.subtotal,
          itemCount: compileResult.data.items.length,
          issues: combinedIssues,
        };
      }
    } else if (inputResolutionIssues.length > 0) {
      compile = {
        status: 'needs_user_input',
        subtotal: 0,
        itemCount: 0,
        issues: inputResolutionIssues,
      };
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
      matches: resolvedMatches,
      unmatchedRequests: unresolvedRequests,
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
  requestLine: ParsedOrderRequestLine,
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

function resolveRequestLineMatch(
  input: {
    requestLine: ParsedOrderRequestLine;
    candidates: CandidateMatch[];
    modifierOnly: boolean;
  },
  selectedRestaurantGuid: string,
): ResolvedMatch {
  if (input.modifierOnly) {
    return {
      requestText: input.requestLine.raw,
      normalizedRequest: input.requestLine.normalized,
      quantity: input.requestLine.quantity,
      resolution: 'modifier_only',
      resolutionReason:
        'Looks like a modifier request without a clear parent item.',
      confidence: null,
      selectedCandidate: null,
      candidates: [],
    };
  }

  const selectedCandidate = input.candidates.find(
    (candidate) => candidate.restaurantGuid === selectedRestaurantGuid,
  );

  const quality = assessCandidateSelectionQuality(
    input.requestLine,
    input.candidates.map((candidate) => candidate.score),
  );

  const confidence = {
    level: quality.level,
    topScore: quality.topScore,
    scoreGap: quality.scoreGap,
  };

  if (!selectedCandidate) {
    return {
      requestText: input.requestLine.raw,
      normalizedRequest: input.requestLine.normalized,
      quantity: input.requestLine.quantity,
      resolution: 'unmatched',
      resolutionReason: 'No candidate matched in selected restaurant scope.',
      confidence,
      selectedCandidate: null,
      candidates: input.candidates,
    };
  }

  if (quality.isAmbiguous || quality.level === 'low') {
    return {
      requestText: input.requestLine.raw,
      normalizedRequest: input.requestLine.normalized,
      quantity: input.requestLine.quantity,
      resolution: 'ambiguous',
      resolutionReason: quality.isAmbiguous
        ? 'Multiple close candidates; needs clarification.'
        : 'Low confidence match; needs clarification.',
      confidence,
      selectedCandidate: null,
      candidates: input.candidates,
    };
  }

  return {
    requestText: input.requestLine.raw,
    normalizedRequest: input.requestLine.normalized,
    quantity: input.requestLine.quantity,
    resolution: 'selected',
    resolutionReason: null,
    confidence,
    selectedCandidate,
    candidates: input.candidates,
  };
}

function buildInputResolutionIssues(matches: ResolvedMatch[]): CompileIssue[] {
  const issues: CompileIssue[] = [];

  for (const match of matches) {
    if (match.resolution === 'selected') {
      continue;
    }

    if (match.resolution === 'modifier_only') {
      issues.push({
        code: 'modifier_context_missing',
        message: `Clarify which item should use modifier: "${match.requestText}"`,
        severity: 'needs_user_input',
      });
      continue;
    }

    if (match.resolution === 'ambiguous') {
      issues.push({
        code: 'ambiguous_item_match',
        message: `Clarify item for: "${match.requestText}"`,
        severity: 'needs_user_input',
      });
      continue;
    }

    issues.push({
      code: 'menu_item_unclear',
      message: `No confident menu match for: "${match.requestText}"`,
      severity: 'needs_user_input',
    });
  }

  return issues;
}
