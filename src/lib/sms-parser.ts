/**
 * Parse incoming SMS from Toast to extract order status and confirmation number.
 */

export type ToastOrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'unknown';

export interface ParsedToastSMS {
  confirmationNumber: string | null;
  status: ToastOrderStatus;
  rawBody: string;
  isOrderUpdate: boolean;
}

const STATUS_PATTERNS: { status: ToastOrderStatus; keywords: string[][] }[] = [
  { status: 'delivered', keywords: [['delivered'], ['arrived'], ['at', 'door'], ['dropped', 'off'], ['enjoy', 'meal'], ['order', 'complete']] },
  { status: 'out_for_delivery', keywords: [['on', 'way'], ['en', 'route'], ['heading', 'your'], ['almost', 'there'], ['minutes', 'away'], ['driver', 'picked']] },
  { status: 'ready', keywords: [['ready', 'pickup'], ['ready', 'pick'], ['order', 'ready']] },
  { status: 'preparing', keywords: [['preparing'], ['being', 'made'], ['making', 'order'], ['cooking'], ['in', 'progress']] },
  { status: 'received', keywords: [['confirmed'], ['received', 'order'], ['accepted'], ['order', 'placed'], ['got', 'order']] },
  { status: 'cancelled', keywords: [['cancelled'], ['canceled'], ['refunded'], ['unable', 'deliver'], ['could', 'not', 'deliver'], ['failed']] },
];

const CONFIRMATION_PATTERNS = [
  /order\s*#?\s*([A-Z0-9-]+)/i,
  /confirmation\s*#?\s*:?\s*([A-Z0-9-]+)/i,
  /reference\s*#?\s*:?\s*([A-Z0-9-]+)/i,
  /#([A-Z0-9-]{4,})/i,
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseToastSMS(body: string): ParsedToastSMS {
  const normalized = normalizeText(body);

  // Extract confirmation/order number
  let confirmationNumber: string | null = null;
  for (const pattern of CONFIRMATION_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1]) {
      confirmationNumber = match[1];
      break;
    }
  }

  // Detect status
  let status: ToastOrderStatus = 'unknown';
  for (const { status: s, keywords } of STATUS_PATTERNS) {
    for (const kws of keywords) {
      if (kws.every(kw => normalized.includes(kw))) {
        status = s;
        break;
      }
    }
    if (status !== 'unknown') break;
  }

  // Determine if this looks like an order update vs marketing/other
  const orderKeywords = ['order', 'delivery', 'pickup', 'food', 'restaurant', 'driver'];
  const isOrderUpdate = status !== 'unknown' || orderKeywords.some(kw => normalized.includes(kw));

  return { confirmationNumber, status, rawBody: body, isOrderUpdate };
}
