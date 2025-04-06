import winston from 'winston';
import { format } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../data/scraper.log'),
      level: 'error' 
    })
  ]
});

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function convertToCSV(data) {
  const header = Object.keys(data[0]).join(',');
  const rows = data.map(obj => 
    Object.values(obj).map(value => 
      `"${String(value).replace(/"/g, '""')}"`
    ).join(',')
  );
  return [header, ...rows].join('\n');
}

export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.imdb.com/search/title/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };