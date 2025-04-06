import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import IMDBScraper from './scraper.js';
import { initializeDatabase, closeDatabase } from './database.js';
import { logger } from './utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('keyword', {
      alias: 'k',
      type: 'string',
      description: 'Search keyword for movies'
    })
    .option('genre', {
      alias: 'g',
      type: 'string',
      description: 'Genre to search for'
    })
    .option('pages', {
      alias: 'p',
      type: 'number',
      default: 1,
      description: 'Number of pages to scrape'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      choices: ['json', 'csv', 'db'],
      default: 'db',
      description: 'Output format'
    })
    .demandOption(['keyword', 'genre'], 'Please provide both keyword and genre arguments')
    .help()
    .argv;

  try {
    await initializeDatabase();
    const scraper = new IMDBScraper();
    const movies = await scraper.searchMovies(argv.keyword, argv.genre, argv.pages);
    
    if (argv.output === 'json') {
      const filePath = path.join(__dirname, '../data/movies.json');
      fs.writeFileSync(filePath, JSON.stringify(movies, null, 2));
      logger.info(`Data saved to ${filePath}`);
    } else if (argv.output === 'csv') {
      const { convertToCSV } = await import('./utils.js');
      const filePath = path.join(__dirname, '../data/movies.csv');
      fs.writeFileSync(filePath, convertToCSV(movies));
      logger.info(`Data saved to ${filePath}`);
    }
    
    logger.info(`Successfully scraped ${movies.length} movies`);
  } catch (error) {
    logger.error('Scraping failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main().catch(console.error);