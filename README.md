#  IMDb Scraper

A Node.js script to scrape movie data from IMDb based on genre or keyword. The script fetches multiple pages of search results and stores extracted data in a SQLite database or a CSV file. Includes error handling, logging, and unit tests.

---

##  Features

- Search movies by genre or keyword
- Extracts:
  -  Title
  -  Release Year
  -  IMDb Rating
  -  Director(s)
  -  Cast
  -  Plot Summary
- Handles pagination (via URL manipulation for efficiency)
- Stores data in:
  -  SQLite database (`data/movies.db`)
  -  CSV file (optional)
- Logs errors to `data/scraper.log`
- Asynchronous scraping using `p-queue`
- Command-line input supported
-  Unit tests included

---

##  Installation

1. **Install Node.js** (v18 or above): [https://nodejs.org](https://nodejs.org)
2. **Clone or Download the project**:
   ```bash
   git clone https://github.com/yourusername/imdb-scraper.git
   cd imdb-scraper

   npm install 

# Run the Scraper

   npm start -- --keyword "action" --genre "action" --pages 3 --output db

   This will scrape ~150 action movies (3 pages × 50 movies) and store them in a SQLite database.

- Arguments:
--keyword or --genre: Required. Specify either one.

--pages: Number of pages to scrape (each ≈ 50 movies).

--output: Choose db (SQLite)

# View the Data (SQLite)

To inspect the SQLite database:

sqlite3 data/movies.db
- Inside the SQLite shell:

SELECT * FROM movies LIMIT 5;
SELECT COUNT(*) FROM movies;

# Run Unit Tests

npm test

# How Pagination Works

IMDb loads more movies when a “Load 50 more” button is clicked. However, handling this with Puppeteer is difficult and unreliable.

Instead, this scraper uses URL tweaking to jump directly to the correct page like this:

https://www.imdb.com/search/title/?genres=action&start=101

This:
- Works faster

- Avoids UI-based clicking

- Still respects IMDb’s pagination format



# Bonus Features Implemented
- Error handling with winston

- Async queue control with p-queue

- CSV exporting

- Unit tests

- Log file generation

- Smart pagination using URL start parameter

