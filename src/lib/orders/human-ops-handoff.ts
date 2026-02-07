import 'server-only';

import { env } from '@/env';
import { getTwilioPhoneNumber, sendSMS } from '@/lib/twilio';
import {
  formatSlackMessage,
  formatSmsMessage,
  type HumanOpsHandoffPayload,
} from '@/lib/orders/human-ops-handoff-shared';

export {
  buildHumanOpsHandoffPayload,
  formatSlackMessage,
  formatSmsMessage,
  type HumanOpsHandoffPayload,
  type HumanOpsHandoffReason,
} from '@/lib/orders/human-ops-handoff-shared';

export interface HumanOpsHandoffDispatchResult {
  ok: boolean;
  slackDelivered: boolean;
  smsDelivered: number;
  errors: string[];
}

export async function dispatchHumanOpsHandoff(
  payload: HumanOpsHandoffPayload,
): Promise<HumanOpsHandoffDispatchResult> {
  const errors: string[] = [];
  let slackDelivered = false;
  let smsDelivered = 0;

  const slackWebhookUrl = env.OPS_HANDOFF_SLACK_WEBHOOK_URL;
  if (slackWebhookUrl) {
    try {
      const res = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: formatSlackMessage(payload) }),
      });
      if (!res.ok) {
        errors.push(`Slack webhook failed with status ${res.status}`);
      } else {
        slackDelivered = true;
      }
    } catch (error) {
      errors.push(
        `Slack webhook error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const smsRecipients = parseSmsRecipients(env.OPS_HANDOFF_SMS_NUMBERS);
  if (smsRecipients.length > 0) {
    const fromNumber = await getTwilioPhoneNumber();
    if (!fromNumber) {
      errors.push('Twilio phone number is not configured for ops SMS alerts');
    } else {
      const messageBody = formatSmsMessage(payload);
      for (const recipient of smsRecipients) {
        const result = await sendSMS(recipient, fromNumber, messageBody);
        if (result.success) {
          smsDelivered += 1;
        } else {
          errors.push(
            `Failed SMS to ${recipient}: ${result.error ?? 'Unknown error'}`,
          );
        }
      }
    }
  }

  if (!slackWebhookUrl && smsRecipients.length === 0) {
    errors.push(
      'No handoff channels configured. Set OPS_HANDOFF_SLACK_WEBHOOK_URL or OPS_HANDOFF_SMS_NUMBERS.',
    );
  }

  return {
    ok: errors.length === 0 && (slackDelivered || smsDelivered > 0),
    slackDelivered,
    smsDelivered,
    errors,
  };
}

function parseSmsRecipients(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
