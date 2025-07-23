// kokomo-event-scraper.js
// Production event scraper for all 14 Kokomo/Howard County sources
// Each adapter returns events in a normalized format

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const ical = require('node-ical');

// Utility: Normalize event object
function normalizeEvent(ev) {
  return {
    title: ev.title || '',
    description: ev.description || '',
    start_date: ev.start_date || '',
    end_date: ev.end_date || '',
    time: ev.time || '',
    venue: ev.venue || '',
    address: ev.address || '',
    category: ev.category || '',
    source: ev.source || '',
    url: ev.url || '',
    kaa_relevant: !!ev.kaa_relevant
  };
}


// 1. visitkokomo.org/calendar-of-events (Cheerio, static HTML)
async function scrapeVisitKokomo() {
  // ...existing code for this adapter...
  const url = 'https://visitkokomo.org/calendar-of-events/';
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const events = [];
  $('.tribe-events-calendar-list__event-row').each((i, el) => {
    const title = $(el).find('.tribe-events-calendar-list__event-title a').text().trim();
    const date = $(el).find('.tribe-event-date-start').attr('datetime') || '';
    const desc = $(el).find('.tribe-events-calendar-list__event-description').text().trim();
    const venue = $(el).find('.tribe-events-venue-details__name').text().trim();
    const address = $(el).find('.tribe-events-venue-details__address').text().trim();
    const urlEv = $(el).find('.tribe-events-calendar-list__event-title a').attr('href');
    events.push(normalizeEvent({
      title,
      description: desc,
      start_date: date,
      venue,
      address,
      category: '',
      source: 'VisitKokomo',
      url: urlEv,
      kaa_relevant: false // TODO: Add logic for KAA relevance
    }));
  });
  return events;
}

// 2. cityofkokomo.org/calendar.php (Cheerio, static HTML, tabs, month loop)
async function scrapeCityOfKokomo() {
  // TODO: Fetch both "Primary" and "Park Events" tabs, loop months if needed
  return [];
}

// 3. greaterkokomo.com/events (Cheerio, ChamberMaster JSON in HTML)
async function scrapeGreaterKokomo() {
  // TODO: Extract ChamberMaster JSON from page
  return [];
}

// 4. townepost.com/kokomo/calendar (Cheerio, WordPress table)
async function scrapeTownePost() {
  // TODO: Parse visible table, ignore past months
  return [];
}

// 5. thekokomopost.com/calendar (Puppeteer, React SPA)
async function scrapeKokomoPost() {
  // TODO: Use Puppeteer to wait for DOM, then Cheerio
  return [];
}

// 6. greaterkokomo.com/community-calendar (Cheerio, ChamberMaster engine)
async function scrapeGreaterKokomoCommunity() {
  // TODO: Same as #3, but flag as different source
  return [];
}

// 7. kokomotribune.com/events (Cheerio, JSON-LD in script tag)
async function scrapeKokomoTribune() {
  // TODO: Extract JSON-LD from script tag
  return [];
}

// 8. wwki.com/event-calendar (.ics, node-ical)
async function scrapeWWKI() {
  // TODO: Download and parse .ics file
  return [];
}

// 9. eventbrite.com/d/in--kokomo/events (Puppeteer, JS cards)
async function scrapeEventbrite() {
  // TODO: Use Puppeteer to wait for event cards, then Cheerio
  return [];
}

// 10. greaterkokomo.chambermaster.com/events/calendar (Cheerio, legacy HTML)
async function scrapeChamberMasterLegacy() {
  // TODO: Parse legacy HTML, dedupe with #3/#6
  return [];
}

// 11. howardcountymuseum.org/programs/calendar-hchs (Cheerio, Rails, data-event-json)
async function scrapeHowardCountyMuseum() {
  // TODO: Extract events from data-event-json attribute
  return [];
}

// 12. patch.com/indiana/kokomo-in/calendar (Cheerio, React, paginated)
async function scrapePatch() {
  // TODO: Parse initial month, optionally paginate
  return [];
}

// 13. khcpl.libnet.info/events (Cheerio, Communico JSON in page)
async function scrapeKHCPL() {
  // TODO: Extract Communico JSON from page
  return [];
}

// 14. happeningnext.com/kokomo (Cheerio, static HTML anchors)
async function scrapeHappeningNext() {
  // TODO: Parse static HTML anchors with data attributes
  return [];
}


// Main: Run all scrapers and deduplicate
async function scrapeAllEvents() {
  let allEvents = [];
  try {
    const results = await Promise.all([
      scrapeVisitKokomo(),
      scrapeCityOfKokomo(),
      scrapeGreaterKokomo(),
      scrapeTownePost(),
      scrapeKokomoPost(),
      scrapeGreaterKokomoCommunity(),
      scrapeKokomoTribune(),
      scrapeWWKI(),
      scrapeEventbrite(),
      scrapeChamberMasterLegacy(),
      scrapeHowardCountyMuseum(),
      scrapePatch(),
      scrapeKHCPL(),
      scrapeHappeningNext()
    ]);
    allEvents = results.flat();
  } catch (e) {
    console.error('Scraper error:', e);
  }
  // TODO: Deduplication logic (title+date+venue key)
  return allEvents;
}

module.exports = { scrapeAllEvents };
