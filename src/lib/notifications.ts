import 'server-only';
import { sendSMS, getTwilioPhoneNumber } from '@/lib/twilio';
import type { ToastOrderStatus } from '@/lib/sms-parser';

const STATUS_MESSAGES: Record<ToastOrderStatus, string | null> = {
  received: 'Your order has been received by the restaurant.',
  preparing: 'Your food is being prepared.',
  ready: 'Your order is ready for pickup.',
  out_for_delivery: 'Your order is on its way!',
  delivered: 'Your order has been delivered. Enjoy!',
  cancelled: 'Your order has been cancelled. Please contact the front desk for assistance.',
  unknown: null, // Don't send noise
};

/**
 * Send order confirmation SMS to guest after bot successfully places order.
 */
export async function sendOrderConfirmationSMS({
  guestPhone,
  guestName,
  confirmationNumber,
  restaurantName,
}: {
  guestPhone: string;
  guestName: string;
  confirmationNumber?: string;
  restaurantName: string;
}) {
  const fromNumber = await getTwilioPhoneNumber();
  if (!fromNumber || !guestPhone) return null;

  const orderRef = confirmationNumber ? ` (Order #${confirmationNumber})` : '';
  const body = `Hi ${guestName}! Your order from ${restaurantName} has been placed${orderRef}. We'll text you updates.`;

  return sendSMS(guestPhone, fromNumber, body);
}

/**
 * Send status update SMS to guest when Toast sends us an update.
 */
export async function sendStatusUpdateSMS({
  guestPhone,
  status,
  confirmationNumber,
}: {
  guestPhone: string;
  status: ToastOrderStatus;
  confirmationNumber?: string;
}) {
  const fromNumber = await getTwilioPhoneNumber();
  if (!fromNumber || !guestPhone) return null;

  const message = STATUS_MESSAGES[status];
  if (!message) return null; // Don't send for unknown status

  const orderRef = confirmationNumber ? ` (Order #${confirmationNumber})` : '';
  const body = `Simon InHouse${orderRef}: ${message}`;

  return sendSMS(guestPhone, fromNumber, body);
}
