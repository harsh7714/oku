const getTurnIceServers = async (req, res) => {
  const { METERED_DOMAIN, METERED_API_KEY } = process.env;

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
