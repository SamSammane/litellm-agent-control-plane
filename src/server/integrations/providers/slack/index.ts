/**
 * Slack integration.
 *
 * Wires the four sibling modules into one Integration:
 *   - oauth.ts    — Slack OAuth v2 (bot token install)
 *   - webhook.ts  — verify signing-secret + parse event_callback
 *   - activity.ts — chat.postMessage on outbound SessionEvent
 *
 * `enabled()` returns false until the operator sets SLACK_CLIENT_ID,
 * SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET. The registry skips
 * disabled integrations; their routes return 404.
 */

import type { Integration } from "../../core/types";
import { buildOAuthAdapter } from "./oauth";
import { buildWebhookAdapter } from "./webhook";
import { postActivity } from "./activity";

const integration: Integration = {
  id: "slack",
  displayName: "Slack",
  icon: "/integrations/slack.svg",
  docsUrl: "https://api.slack.com/start",

  enabled() {
    return Boolean(
      process.env.SLACK_CLIENT_ID &&
        process.env.SLACK_CLIENT_SECRET &&
        process.env.SLACK_SIGNING_SECRET,
    );
  },

  oauth: buildOAuthAdapter(),
  webhook: buildWebhookAdapter(),

  async onSessionEvent(ctx) {
    await postActivity(integration, ctx);
  },
};

export default integration;
