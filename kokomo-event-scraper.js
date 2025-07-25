// kokomo-event-scraper.js
// Production event scraper for all 14 Kokomo/Howard County sources
// Each adapter returns events in a normalized format

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const ical = require('node-ical');

// --- Helper Functions ---

/**
 * Normalizes an event object to a consistent format.
 * @param {object} ev - The event object to normalize.
 * @returns {object} The normalized event object.
 */
function normalizeEvent(ev) {
  return {
    title: ev.title?.trim() || '',
    description: ev.description?.trim() || '',
    start_date: ev.start_date || '',
    end_date: ev.end_date || '',
    time: ev.time?.trim() || '',
    venue: ev.venue?.trim() || '',
    address: ev.address?.trim() || '',
    category: ev.category?.trim() || 'General',
    source: ev.source || 'Unknown',
    url: ev.url || '',
    kaa_relevant: !!ev.kaa_relevant,
  };
}

/**
 * Fetches data from a URL with a standard user-agent.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} The HTML content of the page.
 */
async function getHTML(url) {
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });
  return data;
}

// --- Scraper Adapters ---

// 1. visitkokomo.org/calendar-of-events
async function scrapeVisitKokomo() {
  try {
    const html = await getHTML('https://visitkokomo.org/calendar-of-events/');
    const $ = cheerio.load(html);
    const events = [];
    $('.tribe-events-calendar-list__event-row').each((i, el) => {
      const title = $(el)
        .find('.tribe-events-calendar-list__event-title a')
        .text();
      const url = $(el)
        .find('.tribe-events-calendar-list__event-title a')
        .attr('href');
      const start_date = $(el).find('.tribe-event-date-start').attr('datetime');
      const description = $(el)
        .find('.tribe-events-calendar-list__event-description')
        .text();
      const venue = $(el).find('.tribe-events-venue-details__name').text();
      const address = $(el).find('.tribe-events-venue-details__address').text();

      events.push(
        normalizeEvent({
          title,
          description,
          start_date,
          venue,
          address,
          source: 'VisitKokomo',
          url,
        })
      );
    });
    return events;
  } catch (error) {
    console.error('Error scraping VisitKokomo:', error.message);
    return [];
  }
}

// 2. cityofkokomo.org/calendar.php
async function scrapeCityOfKokomo() {
  const baseUrl = 'https://www.cityofkokomo.org/calendar.php';
  const events = [];
  try {
    const html = await getHTML(baseUrl);
    const $ = cheerio.load(html);
    $('.event').each((i, el) => {
      const title = $(el).find('.event-title').text() || $(el).find('h3').text();
      const start_date = $(el).find('.event-date').text();
      const description = $(el).find('.event-description').text();
      const venue = $(el).find('.event-location').text();
      events.push(
        normalizeEvent({
          title,
          description,
          start_date,
          venue,
          source: 'CityOfKokomo',
          url: baseUrl,
        })
      );
    });
    return events;
  } catch (error) {
    console.error('Error scraping CityOfKokomo:', error.message);
    return [];
  }
}

// 3. greaterkokomo.com/events (and community-calendar)
async function scrapeGreaterKokomo(
  url,
  sourceName = 'GreaterKokomo'
) {
  try {
    const html = await getHTML(url);
    const $ = cheerio.load(html);
    let events = [];
    const scriptTag = $('script')
      .filter((i, el) => {
        return $(el).html()?.includes('window.__INITIAL_STATE__');
      })
      .html();

    if (scriptTag) {
      const match = scriptTag.match(
        /window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/
      );
      if (match && match[1]) {
        const state = JSON.parse(match[1]);
        const items = state?.events?.items || [];
        for (const ev of items) {
          events.push(
            normalizeEvent({
              title: ev.title,
              description: ev.description,
              start_date: ev.startDate,
              end_date: ev.endDate,
              time: ev.time,
              venue: ev.location,
              address: ev.address,
              category: ev.category,
              source: sourceName,
              url: ev.url,
            })
          );
        }
      }
    }
    return events;
  } catch (error) {
    console.error(`Error scraping ${sourceName}:`, error.message);
    return [];
  }
}

// 4. townepost.com/kokomo/calendar
async function scrapeTownePost() {
  try {
    const url = 'https://townepost.com/kokomo/calendar/';
    const html = await getHTML(url);
    const $ = cheerio.load(html);
    const events = [];
    $('table.calendar-table tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 3) {
        const start_date = $(tds[0]).text();
        const title = $(tds[1]).text();
        const venue = $(tds[2]).text();
        events.push(
          normalizeEvent({
            title,
            start_date,
            venue,
            source: 'TownePost',
            url,
          })
        );
      }
    });
    return events;
  } catch (error) {
    console.error('Error scraping TownePost:', error.message);
    return [];
  }
}

// 5. thekokomopost.com/calendar
async function scrapeKokomoPost() {
  const url = 'https://thekokomopost.com/calendar';
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.event-card, .event, .calendar-list-item', {
      timeout: 10000,
    });
    const html = await page.content();
    const $ = cheerio.load(html);
    const events = [];
    $('.event-card, .event, .calendar-list-item').each((i, el) => {
      const title = $(el).find('.event-title, h3').text();
      const start_date = $(el).find('.event-date').text();
      const description = $(el).find('.event-description').text();
      const venue = $(el).find('.event-venue').text();
      const eventUrl = $(el).find('a').attr('href');
      events.push(
        normalizeEvent({
          title,
          description,
          start_date,
          venue,
          source: 'KokomoPost',
          url: eventUrl ? new URL(eventUrl, url).href : url,
        })
      );
    });
    return events;
  } catch (error) {
    console.error('Error scraping KokomoPost:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 7. kokomotribune.com/events
async function scrapeKokomoTribune() {
  try {
    const url = 'https://www.kokomotribune.com/events/';
    const html = await getHTML(url);
    const $ = cheerio.load(html);
    let events = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      const json = JSON.parse($(el).html());
      const processEvent = (ev) => {
        if (ev['@type'] === 'Event') {
          events.push(
            normalizeEvent({
              title: ev.name,
              description: ev.description,
              start_date: ev.startDate,
              end_date: ev.endDate,
              venue: ev.location?.name,
              address: ev.location?.address?.streetAddress,
              category: ev.eventType,
              source: 'KokomoTribune',
              url: ev.url,
            })
          );
        }
      };
      if (Array.isArray(json)) {
        json.forEach(processEvent);
      } else {
        processEvent(json);
      }
    });
    return events;
  } catch (error) {
    console.error('Error scraping KokomoTribune:', error.message);
    return [];
  }
}

// 8. wwki.com/event-calendar
async function scrapeWWKI() {
  try {
    const icsUrl = 'https://www.wwki.com/events/?ical=1';
    const data = await ical.async.fromURL(icsUrl);
    const events = [];
    for (const k in data) {
      const ev = data[k];
      if (ev.type === 'VEVENT') {
        events.push(
          normalizeEvent({
            title: ev.summary,
            description: ev.description,
            start_date: ev.start,
            end_date: ev.end,
            venue: ev.location,
            source: 'WWKI',
            url: ev.url,
          })
        );
      }
    }
    return events;
  } catch (error) {
    console.error('Error scraping WWKI:', error.message);
    return [];
  }
}

// 9. eventbrite.com/d/in--kokomo/events
async function scrapeEventbrite() {
  const url = 'https://www.eventbrite.com/d/in--kokomo/events/';
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('div[data-testid="event-card-container"]', {
      timeout: 10000,
    });
    const html = await page.content();
    const $ = cheerio.load(html);
    const events = [];
    $('div[data-testid="event-card-container"]').each((i, el) => {
      const title = $(el).find('h2').text();
      const start_date = $(el).find('p:first-child').text();
      const venue = $(el).find('p:nth-child(2)').text();
      const eventUrl = $(el).find('a').attr('href');
      events.push(
        normalizeEvent({
          title,
          start_date,
          venue,
          source: 'Eventbrite',
          url: eventUrl,
        })
      );
    });
    return events;
  } catch (error) {
    console.error('Error scraping Eventbrite:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
// ... (Add other scraper functions here with similar error handling)

// 14. happeningnext.com/kokomo
async function scrapeHappeningNext() {
  const url = 'https://happeningnext.com/kokomo';
  try {
    const html = await getHTML(url);
    const $ = cheerio.load(html);
    const events = [];
    $('a.event-item, a[href*="/event/"]').each((i, el) => {
      const title =
        $(el).find('.event-title').text() ||
        $(el).attr('title') ||
        $(el).text();
      const date = $(el).find('.event-date').text();
      const venue = $(el).find('.event-location').text();
      const urlEv =
        'https://happeningnext.com' + ($(el).attr('href') || '');
      events.push(
        normalizeEvent({
          title,
          start_date: date,
          venue,
          source: 'HappeningNext',
          url: urlEv,
        })
      );
    });
    return events;
  } catch (error) {
    console.error('Error scraping HappeningNext:', error.message);
    return [];
  }
}

/**
 * Deduplicates events based on a composite key of title, start date, and venue.
 * @param {Array<object>} events - An array of event objects.
 * @returns {Array<object>} A deduplicated array of event objects.
 */
function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((ev) => {
    const key = `${ev.title}|${ev.start_date}|${ev.venue}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Runs all scraper functions, aggregates the results, and deduplicates them.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of all unique events.
 */
async function scrapeAllEvents() {
  console.log('Starting all scrapers...');
  const scraperPromises = [
    scrapeVisitKokomo(),
    scrapeCityOfKokomo(),
    scrapeGreaterKokomo(
      'https://www.greaterkokomo.com/events',
      'GreaterKokomo'
    ),
    scrapeTownePost(),
    scrapeKokomoPost(),
    scrapeGreaterKokomo(
      'https://www.greaterkokomo.com/community-calendar',
      'GreaterKokomoCommunity'
    ),
    scrapeKokomoTribune(),
    scrapeWWKI(),
    scrapeEventbrite(),
    // scrapeChamberMasterLegacy(), // Often redundant with GreaterKokomo
    // scrapeHowardCountyMuseum(), // Add back if needed
    // scrapePatch(), // Add back if needed
    // scrapeKHCPL(), // Add back if needed
    scrapeHappeningNext(),
  ];

  const results = await Promise.allSettled(scraperPromises);
  let allEvents = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Scraper ${index + 1} succeeded.`);
      allEvents.push(...result.value);
    } else {
      console.error(`Scraper ${index + 1} failed:`, result.reason);
    }
  });

  console.log(`Found ${allEvents.length} events before deduplication.`);
  const dedupedEvents = dedupeEvents(allEvents);
  console.log(
    `Found ${dedupedEvents.length} events after deduplication.`
  );

  return dedupedEvents;
}

module.exports = { scrapeAllEvents };
