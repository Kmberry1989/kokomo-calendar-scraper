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
  // This implementation fetches the current month for both tabs. For more months, loop with ?month=YYYY-MM
  const baseUrl = 'https://www.cityofkokomo.org/calendar.php';
  const tabs = ['Primary', 'Park Events'];
  let events = [];
  for (const tab of tabs) {
    try {
      const res = await axios.get(baseUrl + `?tab=${encodeURIComponent(tab)}`);
      const $ = cheerio.load(res.data);
      $('.event').each((i, el) => {
        const title = $(el).find('.event-title').text().trim() || $(el).find('h3').text().trim();
        const date = $(el).find('.event-date').text().trim();
        const desc = $(el).find('.event-description').text().trim();
        const venue = $(el).find('.event-location').text().trim();
        events.push(normalizeEvent({
          title,
          description: desc,
          start_date: date,
          venue,
          address: '',
          category: tab,
          source: 'CityOfKokomo',
          url: baseUrl,
          kaa_relevant: false
        }));
      });
    } catch (e) {}
  }
  return events;
}

// 3. greaterkokomo.com/events (Cheerio, ChamberMaster JSON in HTML)
async function scrapeGreaterKokomo() {
  // ChamberMaster JSON is embedded in a <script> tag
  const url = 'https://www.greaterkokomo.com/events';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    let events = [];
    $('script').each((i, el) => {
      const scriptText = $(el).html();
      if (scriptText && scriptText.includes('window.__INITIAL_STATE__')) {
        const match = scriptText.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
        if (match) {
          try {
            const state = JSON.parse(match[1]);
            const items = state?.events?.items || [];
            for (const ev of items) {
              events.push(normalizeEvent({
                title: ev.title,
                description: ev.description,
                start_date: ev.startDate,
                end_date: ev.endDate,
                time: ev.time,
                venue: ev.location,
                address: ev.address,
                category: ev.category,
                source: 'GreaterKokomo',
                url: ev.url,
                kaa_relevant: false
              }));
            }
          } catch (e) {}
        }
      }
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 4. townepost.com/kokomo/calendar (Cheerio, WordPress table)
async function scrapeTownePost() {
  // Only future events are public; past months may require login
  const url = 'https://townepost.com/kokomo/calendar/';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const events = [];
    $('table.calendar-table tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 3) {
        const date = $(tds[0]).text().trim();
        const title = $(tds[1]).text().trim();
        const venue = $(tds[2]).text().trim();
        events.push(normalizeEvent({
          title,
          description: '',
          start_date: date,
          venue,
          address: '',
          category: '',
          source: 'TownePost',
          url,
          kaa_relevant: false
        }));
      }
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 5. thekokomopost.com/calendar (Puppeteer, React SPA)
async function scrapeKokomoPost() {
  // Example Puppeteer implementation for a React SPA
  const url = 'https://thekokomopost.com/calendar';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  // Wait for event cards to load (adjust selector as needed)
  await page.waitForSelector('.event-card, .event, .calendar-list');
  const html = await page.content();
  await browser.close();
  const $ = cheerio.load(html);
  const events = [];
  // TODO: Adjust selectors to match actual event card structure
  $('.event-card, .event, .calendar-list .event').each((i, el) => {
    const title = $(el).find('.event-title').text().trim() || $(el).find('h3').text().trim();
    const date = $(el).find('.event-date').text().trim();
    const desc = $(el).find('.event-description').text().trim();
    const venue = $(el).find('.event-venue').text().trim();
    const urlEv = $(el).find('a').attr('href');
    events.push(normalizeEvent({
      title,
      description: desc,
      start_date: date,
      venue,
      address: '',
      category: '',
      source: 'KokomoPost',
      url: urlEv,
      kaa_relevant: false
    }));
  });
  return events;
}

// 6. greaterkokomo.com/community-calendar (Cheerio, ChamberMaster engine)
async function scrapeGreaterKokomoCommunity() {
  // Same as #3, but flag as different source
  const url = 'https://www.greaterkokomo.com/community-calendar';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    let events = [];
    $('script').each((i, el) => {
      const scriptText = $(el).html();
      if (scriptText && scriptText.includes('window.__INITIAL_STATE__')) {
        const match = scriptText.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
        if (match) {
          try {
            const state = JSON.parse(match[1]);
            const items = state?.events?.items || [];
            for (const ev of items) {
              events.push(normalizeEvent({
                title: ev.title,
                description: ev.description,
                start_date: ev.startDate,
                end_date: ev.endDate,
                time: ev.time,
                venue: ev.location,
                address: ev.address,
                category: ev.category,
                source: 'GreaterKokomoCommunity',
                url: ev.url,
                kaa_relevant: false
              }));
            }
          } catch (e) {}
        }
      }
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 7. kokomotribune.com/events (Cheerio, JSON-LD in script tag)
async function scrapeKokomoTribune() {
  // Extract JSON-LD from script tag
  const url = 'https://www.kokomotribune.com/events/';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    let events = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (Array.isArray(json)) {
          for (const ev of json) {
            if (ev['@type'] === 'Event') {
              events.push(normalizeEvent({
                title: ev.name,
                description: ev.description,
                start_date: ev.startDate ? ev.startDate.split('T')[0] : '',
                end_date: ev.endDate ? ev.endDate.split('T')[0] : '',
                time: ev.startDate ? (ev.startDate.split('T')[1] || '').slice(0,5) : '',
                venue: ev.location?.name || '',
                address: ev.location?.address?.streetAddress || '',
                category: ev.eventType || '',
                source: 'KokomoTribune',
                url: ev.url || '',
                kaa_relevant: false
              }));
            }
          }
        } else if (json['@type'] === 'Event') {
          events.push(normalizeEvent({
            title: json.name,
            description: json.description,
            start_date: json.startDate ? json.startDate.split('T')[0] : '',
            end_date: json.endDate ? json.endDate.split('T')[0] : '',
            time: json.startDate ? (json.startDate.split('T')[1] || '').slice(0,5) : '',
            venue: json.location?.name || '',
            address: json.location?.address?.streetAddress || '',
            category: json.eventType || '',
            source: 'KokomoTribune',
            url: json.url || '',
            kaa_relevant: false
          }));
        }
      } catch (e) {}
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 8. wwki.com/event-calendar (.ics, node-ical)
async function scrapeWWKI() {
  // Example .ics file parsing
  const icsUrl = 'https://www.wwki.com/events/?ical=1';
  try {
    const data = await ical.async.fromURL(icsUrl);
    const events = [];
    for (const k in data) {
      const ev = data[k];
      if (ev.type === 'VEVENT') {
        events.push(normalizeEvent({
          title: ev.summary,
          description: ev.description,
          start_date: ev.start ? ev.start.toISOString().split('T')[0] : '',
          end_date: ev.end ? ev.end.toISOString().split('T')[0] : '',
          time: ev.start ? ev.start.toISOString().split('T')[1]?.slice(0,5) : '',
          venue: ev.location || '',
          address: '',
          category: '',
          source: 'WWKI',
          url: '',
          kaa_relevant: false
        }));
      }
    }
    return events;
  } catch (e) {
    return [];
  }
}

// 9. eventbrite.com/d/in--kokomo/events (Puppeteer, JS cards)
async function scrapeEventbrite() {
  // Uses Puppeteer to wait for event cards, then Cheerio
  const url = 'https://www.eventbrite.com/d/in--kokomo/events/';
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.search-event-card-wrapper, .eds-event-card-content__content');
    const html = await page.content();
    await browser.close();
    const $ = cheerio.load(html);
    const events = [];
    $('.search-event-card-wrapper, .eds-event-card-content__content').each((i, el) => {
      const title = $(el).find('.eds-event-card-content__title').text().trim() || $(el).find('h3').text().trim();
      const date = $(el).find('.eds-event-card-content__sub-title').text().trim();
      const venue = $(el).find('.card-text--truncated__one').text().trim();
      const urlEv = $(el).find('a').attr('href');
      events.push(normalizeEvent({
        title,
        description: '',
        start_date: date,
        venue,
        address: '',
        category: '',
        source: 'Eventbrite',
        url: urlEv,
        kaa_relevant: false
      }));
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 10. greaterkokomo.chambermaster.com/events/calendar (Cheerio, legacy HTML)
async function scrapeChamberMasterLegacy() {
  // Parse legacy HTML, dedupe with #3/#6
  const url = 'https://greaterkokomo.chambermaster.com/events/calendar';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const events = [];
    $('.cm-event-listing').each((i, el) => {
      const title = $(el).find('.cm-event-title').text().trim();
      const date = $(el).find('.cm-event-date').text().trim();
      const venue = $(el).find('.cm-event-location').text().trim();
      events.push(normalizeEvent({
        title,
        description: '',
        start_date: date,
        venue,
        address: '',
        category: '',
        source: 'ChamberMasterLegacy',
        url,
        kaa_relevant: false
      }));
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 11. howardcountymuseum.org/programs/calendar-hchs (Cheerio, Rails, data-event-json)
async function scrapeHowardCountyMuseum() {
  // Extract events from data-event-json attribute
  const url = 'https://howardcountymuseum.org/programs/calendar-hchs';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const events = [];
    $('[data-event-json]').each((i, el) => {
      try {
        const json = JSON.parse($(el).attr('data-event-json'));
        events.push(normalizeEvent({
          title: json.title,
          description: json.description,
          start_date: json.start_date,
          end_date: json.end_date,
          time: json.time,
          venue: json.venue,
          address: json.address,
          category: json.category,
          source: 'HowardCountyMuseum',
          url,
          kaa_relevant: false
        }));
      } catch (e) {}
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 12. patch.com/indiana/kokomo-in/calendar (Cheerio, React, paginated)
async function scrapePatch() {
  // Only fetches the first page/month
  const url = 'https://patch.com/indiana/kokomo/calendar';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const events = [];
    $('.calendar-event').each((i, el) => {
      const title = $(el).find('.calendar-event-title').text().trim();
      const date = $(el).find('.calendar-event-date').text().trim();
      const venue = $(el).find('.calendar-event-location').text().trim();
      events.push(normalizeEvent({
        title,
        description: '',
        start_date: date,
        venue,
        address: '',
        category: '',
        source: 'Patch',
        url,
        kaa_relevant: false
      }));
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 13. khcpl.libnet.info/events (Cheerio, Communico JSON in page)
async function scrapeKHCPL() {
  // Extract Communico JSON from page
  const url = 'https://khcpl.libnet.info/events';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    let events = [];
    $('script').each((i, el) => {
      const scriptText = $(el).html();
      if (scriptText && scriptText.includes('window.__INITIAL_DATA__')) {
        const match = scriptText.match(/window\.__INITIAL_DATA__\s*=\s*(\{.*?\});/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const items = data?.events || [];
            for (const ev of items) {
              events.push(normalizeEvent({
                title: ev.title,
                description: ev.description,
                start_date: ev.startDate,
                end_date: ev.endDate,
                time: ev.time,
                venue: ev.location,
                address: ev.address,
                category: ev.category,
                source: 'KHCPL',
                url: ev.url,
                kaa_relevant: false
              }));
            }
          } catch (e) {}
        }
      }
    });
    return events;
  } catch (e) {
    return [];
  }
}

// 14. happeningnext.com/kokomo (Cheerio, static HTML anchors)
async function scrapeHappeningNext() {
  // Parse static HTML anchors with data attributes
  const url = 'https://happeningnext.com/kokomo';
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const events = [];
    $('a.event-item, a[href*="/event/"]').each((i, el) => {
      const title = $(el).find('.event-title').text().trim() || $(el).attr('title') || $(el).text().trim();
      const date = $(el).find('.event-date').text().trim();
      const venue = $(el).find('.event-location').text().trim();
      const urlEv = 'https://happeningnext.com' + ($(el).attr('href') || '');
      events.push(normalizeEvent({
        title,
        description: '',
        start_date: date,
        venue,
        address: '',
        category: '',
        source: 'HappeningNext',
        url: urlEv,
        kaa_relevant: false
      }));
    });
    return events;
  } catch (e) {
    return [];
  }
}



// Deduplicate events by title+date+venue
function dedupeEvents(events) {
  const seen = new Set();
  return events.filter(ev => {
    const key = `${ev.title}|${ev.start_date}|${ev.venue}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  return dedupeEvents(allEvents);
}

module.exports = { scrapeAllEvents };
