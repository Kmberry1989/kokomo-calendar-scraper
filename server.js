// server.js
// Express server to serve /api/events using the Kokomo event scraper

const express = require('express');
const cors = require('cors');
const { scrapeAllEvents } = require('./kokomo-event-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/api/events', async (req, res) => {
  try {
    const events = await scrapeAllEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.listen(PORT, () => {
  console.log(`Kokomo Event Scraper API running on port ${PORT}`);
});
