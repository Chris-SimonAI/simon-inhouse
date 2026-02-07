import { describe, expect, it } from 'vitest';
import {
  chooseBestRestaurantGuid,
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
