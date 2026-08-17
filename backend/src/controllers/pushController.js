import User from '../models/User.js';

// @desc    Get the VAPID public key so the client can create a subscription
// @route   GET /api/push/vapid-public-key
// @access  Private
export const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
};

// @desc    Save a push subscription for the current user/device
// @route   POST /api/push/subscribe
// @access  Private
export const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid push subscription' });
    }

    // Drop any existing entry for this endpoint first so re-subscribing
    // (e.g. after keys rotate) doesn't leave duplicate rows.
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } },
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: { pushSubscriptions: { endpoint, keys } },
    });

    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('subscribe Error:', error);
    res.status(500).json({ message: 'Server error saving push subscription' });
  }
};

// @desc    Remove a push subscription for the current user/device
// @route   POST /api/push/unsubscribe
// @access  Private
export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } },
    });

    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('unsubscribe Error:', error);
    res.status(500).json({ message: 'Server error removing push subscription' });
  }
};
