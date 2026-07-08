/* eslint-disable @typescript-eslint/no-require-imports */
import type { PushSubscription as WebPushSubscription } from "web-push";

function getWebPush() {
  // Lazy-require so this module is only loaded on the server when needed
  const webPush = require("web-push") as typeof import("web-push");
  webPush.setVapidDetails(
    process.env.VAPID_CONTACT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return webPush;
}

export async function sendPushNotification(
  subscription: WebPushSubscription,
  payload: { title: string; body: string; url?: string },
) {
  const webPush = getWebPush();
  await webPush.sendNotification(subscription, JSON.stringify(payload));
}
