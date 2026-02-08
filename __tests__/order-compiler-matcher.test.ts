import { describe, expect, it } from 'vitest';
import {
  assessCandidateSelectionQuality,
  chooseBestRestaurantGuid,
  isLikelyModifierOnlyRequestLine,
  parseOrderRequestLines,
  scoreMenuCandidate,
} from '@/lib/orders/order-compiler-matcher';

describe('parseOrderRequestLines', () => {
  it('extracts quantities and segments from free text', () => {
    const parsed = parseOrderRequestLines(
      'I want 2 spicy chicken sandwiches, fries and a coke',
    );

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.quantity).toBe(2);
    expect(parsed[0]?.normalized).toContain('spicy chicken sandwiches');
    expect(parsed[1]?.normalized).toBe('fries');
    expect(parsed[2]?.normalized).toBe('coke');
  });
});

describe('scoreMenuCandidate', () => {
  it('scores exact name matches higher than partial matches', () => {
    const request = parseOrderRequestLines('chicken sandwich')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    const exact = scoreMenuCandidate(
      request,
      'Chicken Sandwich',
      'grilled chicken on brioche',
    );
    const partial = scoreMenuCandidate(
      request,
      'Chicken Club',
      'club sandwich with bacon',
    );

    expect(exact.score).toBeGreaterThan(partial.score);
  });

  it('prefers entree-style salads over spread salads for generic salad intent', () => {
    const request = parseOrderRequestLines('i want a salad')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    const entree = scoreMenuCandidate(
      request,
      'Caesar Salad',
      'romaine, parmesan, croutons',
    );
    const spread = scoreMenuCandidate(
      request,
      '8oz Chicken Salad',
      'house-made chicken salad spread',
    );

    expect(entree.score).toBeGreaterThan(spread.score);
  });

  it('keeps chicken salad strong when user explicitly asks for it', () => {
    const request = parseOrderRequestLines('chicken salad')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    const chicken = scoreMenuCandidate(
      request,
      '8oz Chicken Salad',
      'house-made chicken salad spread',
    );
    const caesar = scoreMenuCandidate(
      request,
      'Caesar Salad',
      'romaine, parmesan, croutons',
    );

    expect(chicken.score).toBeGreaterThan(caesar.score);
  });
});

describe('modifier detection', () => {
  it('classifies short modifier lines as modifier-only', () => {
    const request = parseOrderRequestLines('no onions')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    expect(isLikelyModifierOnlyRequestLine(request)).toBe(true);
  });

  it('does not classify explicit item requests as modifier-only', () => {
    const request = parseOrderRequestLines('extra crispy chicken sandwich')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    expect(isLikelyModifierOnlyRequestLine(request)).toBe(false);
  });
});

describe('assessCandidateSelectionQuality', () => {
  it('marks tied generic requests as ambiguous low-confidence', () => {
    const request = parseOrderRequestLines('salad')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    const quality = assessCandidateSelectionQuality(request, [98, 98, 94]);

    expect(quality.level).toBe('low');
    expect(quality.isAmbiguous).toBe(true);
  });

  it('marks clear wins as high-confidence', () => {
    const request = parseOrderRequestLines('chicken sandwich')[0];
    if (!request) {
      throw new Error('Expected parsed request');
    }

    const quality = assessCandidateSelectionQuality(request, [140, 90, 80]);

    expect(quality.level).toBe('high');
    expect(quality.isAmbiguous).toBe(false);
  });
});

describe('chooseBestRestaurantGuid', () => {
  it('chooses restaurant with highest request coverage, then score', () => {
    const selected = chooseBestRestaurantGuid([
      [
        { restaurantGuid: 'r1', score: 90 },
        { restaurantGuid: 'r2', score: 100 },
      ],
      [
        { restaurantGuid: 'r1', score: 80 },
      ],
    ]);

    expect(selected).toBe('r1');
  });
});
