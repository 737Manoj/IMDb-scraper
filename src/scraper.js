import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { fileURLToPath } from 'url';
import path from 'path';
import { storeMovie } from './database.js';
import { logger, delay, HEADERS } from './utils.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.imdb.com';
const SEARCH_URL = `${BASE_URL}/search/title/`;

export default class IMDBScraper {
  constructor() {
    this.requestQueue = new PQueue({
      concurrency: 1,
      interval: 2000,
      intervalCap: 1
    });
    this.cache = new Map();
  }

  async searchMovies(keyword, genre, maxPages = 5, output = 'db') {
    try {
      const movies = [];
      const count = maxPages * 50; // 50 movies per "page" in one shot
      const searchParams = new URLSearchParams({
        'title': keyword || '',
        'genres': genre,
        'title_type': 'feature',
        'sort': 'user_rating,desc',
        'count': count, // Total movies to fetch
        'start': 1 // Start at the beginning
      });
      const searchUrl = `${SEARCH_URL}?${searchParams.toString()}`;
      logger.info(`Scraping ${count} movies for ${keyword || genre} at ${searchUrl}`);

      const html = await this._fetchPageWithPuppeteer(searchUrl);
      const results = await this._parseSearchResults(html, 1);
      movies.push(...results);

      logger.info(`Total movies parsed: ${movies.length}`);
      const movieDetails = [];
      const seenUrls = new Set();
      for (const [index, movie] of movies.entries()) {
        logger.info(`Processing movie ${index + 1}/${movies.length}: ${movie.title} (${movie.url})`);
        const details = await this._getMovieDetails(movie);
        if (!seenUrls.has(details.url)) {
          await storeMovie(details);
          seenUrls.add(details.url);
        } else {
          logger.info(`Skipped duplicate: ${details.title} (${details.url})`);
        }
        movieDetails.push(details);
      }

      logger.info(`Successfully scraped ${movieDetails.length} movies (${seenUrls.size} unique)`);
      return movieDetails;
    } catch (error) {
      logger.error(`Error in searchMovies: ${error.message}`);
      throw error;
    }
  }

  async _fetchPageWithPuppeteer(url) {
    try {
      const browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(HEADERS);
      await page.setViewport({ width: 1280, height: 800 });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(2000); // Buffer for full render

      const itemCount = await page.evaluate(() => document.querySelectorAll('.ipc-metadata-list-summary-item').length);
      logger.info(`Loaded ${itemCount} items`);

      const html = await page.content();
      fs.writeFileSync(`debug_page.html`, html);
      await browser.close();
      return html;
    } catch (error) {
      logger.error(`Failed to fetch page with Puppeteer: ${error.message}`);
      throw error;
    }
  }

  async _parseSearchResults(html, pageNum) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.ipc-metadata-list-summary-item').each((i, element) => {
      try {
        if ($(element).find('span.ipc-metadata-list-item__label:contains("Episode")').length) {
          return; // Skip episodes
        }
        const titleElement = $(element).find('.ipc-title__text');
        const title = titleElement.text().trim();
        const url = $(element).find('.ipc-title-link-wrapper').attr('href');
        const year = $(element).find('.sc-2bbfc9e9-7').first().text().trim() || 'N/A';
        const rating = $(element).find('.ipc-rating-star--rating').text().trim() || 'N/A';
        const plot = $(element).find('.ipc-html-content-inner-div').text().trim() || 'N/A';

        if (title && url) {
          const movie = {
            title: title.replace(/^\d+\.\s*/, ''),
            url: `${BASE_URL}${url.split('?')[0]}`,
            year,
            rating,
            plot
          };
          results.push(movie);
          logger.debug(`Parsed movie ${i + 1}: ${movie.title} (${movie.url})`);
        }
      } catch (error) {
        logger.error(`Error parsing movie ${i}: ${error.message}`);
      }
    });

    logger.info(`Found ${results.length} movies`);
    return results; // Just return results, no hasNext
  }

  async _getMovieDetails(movie) {
    if (movie.plot && movie.plot !== 'N/A') {
      return movie;
    }
  
    try {
      if (this.cache.has(movie.url)) {
        logger.info(`Cache hit for ${movie.url}`);
        return { ...movie, ...this.cache.get(movie.url) };
      }
  
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(HEADERS);
      await page.goto(movie.url, { waitUntil: 'networkidle2' });
      const html = await page.content();
      await browser.close();
  
      const $ = cheerio.load(html);
      const directors = $('[data-testid="title-pc-principal-credit"]').eq(0)
        .find('a')
        .map((i, el) => $(el).text().trim())
        .get();
  
      const actors = $('[data-testid="title-cast-item"] [data-testid="title-cast-item__actor"]')
        .map((i, el) => $(el).text().trim())
        .get()
        .slice(0, 5);
  
      const details = {
        directors: directors.length ? directors.join(', ') : 'N/A',
        actors: actors.length ? actors.join(', ') : 'N/A',
        plot: (movie.plot && movie.plot !== 'N/A') 
        ? movie.plot 
        : ($('[data-testid="plot"] span').first().text().trim() || 'N/A')
      };
      this.cache.set(movie.url, details);
      return { ...movie, ...details };
    } catch (error) {
      logger.error(`Failed to get details for ${movie.title}: ${error.message}`);
      return {
        ...movie,
        directors: 'N/A',
        actors: 'N/A',
      };
    }
  }
}