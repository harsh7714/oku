import webpush from 'web-push';
import User from '../models/User.js';

// VAPID setup is deferred to first use (rather than done at module-eval
// time) because ES module imports are hoisted and run before server.js's
// top-level `dotenv.config()` call — reading process.env.VAPID_* here at
// import time would always see them as undefined.
let vapidConfigured = false;

const ensureVapidConfigured = () => {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured — push notifications are disabled.');
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
};

// Sends a push payload to every subscription (device/browser) a user has
// registered. Best-effort: a subscription the push service no longer
// recognizes (endpoint expired/unsubscribed at the OS level) is pruned from
// the user record instead of failing the whole call.
export const sendPushToUser = async (userId, payload) => {
  if (!ensureVapidConfigured()) return;

  const user = await User.findById(userId).select('pushSubscriptions');
  if (!user?.pushSubscriptions?.length) return;

  const json = JSON.stringify(payload);
  const staleEndpoints = [];

  await Promise.all(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, json);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error('Push send error:', error.message);
        }
      }
    })
  );

  if (staleEndpoints.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } },
    });
  }
};
