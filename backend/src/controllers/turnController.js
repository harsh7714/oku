const getTurnIceServers = async (req, res) => {
  const { METERED_DOMAIN, METERED_API_KEY, METERED_TURN_URLS, METERED_TURN_USERNAME, METERED_TURN_CREDENTIAL } = process.env;

  // The API-key flow is preferred because Metered can rotate credentials.
  // The direct flow is useful when the dashboard only provides the copied
  // ICE server array (and keeps those values on Render, never in Netlify).
  if (!METERED_API_KEY && METERED_TURN_URLS && METERED_TURN_USERNAME && METERED_TURN_CREDENTIAL) {
    const urls = METERED_TURN_URLS.split(',').map((url) => url.trim()).filter(Boolean);
    return res.json({
      iceServers: [{ urls, username: METERED_TURN_USERNAME, credential: METERED_TURN_CREDENTIAL }],
    });
  }

  if (!METERED_DOMAIN || !METERED_API_KEY) {
    return res.status(503).json({ message: 'TURN service is not configured' });
  }

  try {
    const response = await fetch(
      `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(METERED_API_KEY)}`
    );

    if (!response.ok) throw new Error(`TURN provider responded with ${response.status}`);

    const iceServers = await response.json();
    return res.json({ iceServers });
  } catch (error) {
    console.error('TURN credentials error:', error);
    return res.status(502).json({ message: 'Could not load TURN configuration' });
  }
};

export { getTurnIceServers };
