// server.jsconst express = require('express');
const cors = require('cors');
const path = require('path'); // Import the 'path' module
const { scrapeAllEvents } = require('./kokomo-event-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files (index.html, app.js, style.css) from the root directory
app.use(express.static(path.join(__dirname)));

// API endpoint for fetching events
app.get('/api/events', async (req, res) => {
  console.log('Received request for /api/events');
  try {
    const events = await scrapeAllEvents();
    res.json(events);
  } catch (err) {
    console.error('Error in /api/events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.listen(PORT, () => {
  console.log(`Kokomo Event Scraper server running.`);
  console.log(`Open your browser and navigate to http://localhost:${PORT}`);
});
