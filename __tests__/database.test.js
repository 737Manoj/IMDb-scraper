import { jest } from '@jest/globals';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.join(__dirname, '../data/test_movies.db');

// Mock logger
jest.unstable_mockModule('../src/utils.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocking
const { initializeDatabase, storeMovie, closeDatabase } = await import('../src/database.js');

describe('Database Functions', () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    process.env.DB_PATH = TEST_DB_PATH;
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for DB to release
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('initializeDatabase creates movies table', async () => {
    const db = new sqlite3.Database(TEST_DB_PATH);
    const schema = await new Promise((resolve) => {
      db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='movies'", (err, row) => {
        resolve(row ? row.sql : null);
      });
    });
    expect(schema).toContain('CREATE TABLE movies');
    expect(schema).toContain('actors TEXT');
    expect(schema).toContain('url TEXT UNIQUE');
    db.close();
  });

  test('storeMovie inserts a new movie', async () => {
    const movie = {
      title: 'Test Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2023',
      rating: '8.5',
      plot: 'A test plot',
      directors: 'John Doe',
      actors: 'Jane Doe, Bob Smith',
    };
    await storeMovie(movie);

    const db = new sqlite3.Database(TEST_DB_PATH);
    const row = await new Promise((resolve) => {
      db.get('SELECT * FROM movies WHERE url = ?', [movie.url], (err, row) => resolve(row));
    });
    expect(row).toMatchObject(movie);
    expect(row.id).toBeDefined();
    expect(row.created_at).toBeDefined();
    db.close();
  });

  test('storeMovie skips duplicate URLs', async () => {
    const movie = {
      title: 'Duplicate Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2024',
      rating: '9.0',
      plot: 'Another plot',
      directors: 'Jane Smith',
      actors: 'Tom Lee',
    };
    await storeMovie(movie);

    const db = new sqlite3.Database(TEST_DB_PATH);
    const count = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM movies', (err, row) => resolve(row ? row.count : 0));
    });
    expect(count).toBe(1);
    const row = await new Promise((resolve) => {
      db.get('SELECT title FROM movies WHERE url = ?', [movie.url], (err, row) => resolve(row));
    });
    expect(row.title).toBe('Test Movie');
    db.close();
  }, 10000); // Increase timeout to 10s
});