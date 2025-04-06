import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

let db;

export async function initializeDatabase() {
  const { logger } = await import('./utils.js'); // Dynamic import
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/movies.db');

  const dbDir = path.join(__dirname, '../data');
  try {
    await fs.promises.mkdir(dbDir, { recursive: true });
  } catch (err) {
    logger.error('Error creating data directory:', err);
  }

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        return reject(err);
      }
      
      db.run(`CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        year TEXT,
        rating TEXT,
        directors TEXT,
        actors TEXT,
        plot TEXT,
        url TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          logger.error('Error creating table:', err);
          return reject(err);
        }
        logger.info('Database initialized successfully');
        resolve();
      });
    });
  });
}

export async function storeMovie(movie) {
  const { logger } = await import('./utils.js'); // Dynamic import
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO movies (title, year, rating, directors, actors, plot, url) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [movie.title, movie.year, movie.rating, movie.directors, movie.actors, movie.plot, movie.url],
      (err) => {
        if (err) {
          logger.error(`Error storing movie ${movie.title}:`, err);
          return reject(err);
        }
        logger.info(`Stored movie: ${movie.title} (${movie.url})`);
        resolve();
      }
    );
  });
}

export async function closeDatabase() {
  const { logger } = await import('./utils.js'); // Dynamic import
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}