import { jest } from '@jest/globals';

// Mock dependencies
const mockPuppeteer = {
  launch: jest.fn().mockImplementation(() => ({
    newPage: jest.fn().mockResolvedValue({
      setExtraHTTPHeaders: jest.fn(),
      goto: jest.fn(),
      content: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
      setViewport: jest.fn()
    }),
    close: jest.fn()
  }))
};

jest.unstable_mockModule('puppeteer', () => ({
  default: mockPuppeteer
}));

jest.unstable_mockModule('../src/database.js', () => ({
  storeMovie: jest.fn().mockResolvedValue()
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  },
  delay: jest.fn().mockResolvedValue(),
  HEADERS: {}
}));

describe('IMDBScraper', () => {
  let IMDBScraper;
  let scraper;

  beforeAll(async () => {
    jest.resetModules();
    const module = await import('../src/scraper.js');
    IMDBScraper = module.default;
  });

  beforeEach(() => {
    scraper = new IMDBScraper();
    mockPuppeteer.launch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('_parseSearchResults parses movie list and skips episodes', async () => {
    const html = `
      <ul>
        <li class="ipc-metadata-list-summary-item">
          <div class="ipc-title__text">1. Test Movie</div>
          <a class="ipc-title-link-wrapper" href="/title/tt0000001/"></a>
          <span class="sc-2bbfc9e9-7">2023</span>
          <div class="ipc-rating-star--rating">8.5</div>
          <div class="ipc-html-content-inner-div">A test plot</div>
        </li>
        <li class="ipc-metadata-list-summary-item">
          <div class="ipc-title__text">2. Test Episode</div>
          <a class="ipc-title-link-wrapper" href="/title/tt0000002/"></a>
          <span class="sc-2bbfc9e9-7">2023</span>
          <div class="ipc-rating-star--rating">8.0</div>
          <div class="ipc-html-content-inner-div">An episode</div>
          <span class="ipc-metadata-list-item__label">Episode</span>
        </li>
      </ul>
    `;
    const results = await scraper._parseSearchResults(html, 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Test Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2023',
      rating: '8.5',
      plot: 'A test plot'
    });
  });

  test('_getMovieDetails fetches details and caches', async () => {
    const movie = { 
      title: 'Test Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2023',
      rating: '8.5',
      plot: 'N/A'
    };

    // Mock HTML that exactly matches the scraper's selectors
    const mockHtmlContent = `
      <div data-testid="title-pc-principal-credit">
        <div class="ipc-metadata-list-item__content-container">
          <ul class="ipc-inline-list ipc-inline-list--show-dividers ipc-inline-list--inline ipc-metadata-list-item__list-content baseAlt">
            <li class="ipc-inline-list__item"><a>John Doe</a></li>
          </ul>
        </div>
      </div>
      <div data-testid="title-cast-item">
        <a data-testid="title-cast-item__actor">Jane Doe</a>
      </div>
      <div data-testid="title-cast-item">
        <a data-testid="title-cast-item__actor">Bob Smith</a>
      </div>
      <div data-testid="plot">
        <span class="ipc-html-content-inner-div">Detailed plot</span>
      </div>
    `;

    const mockPage = {
      setExtraHTTPHeaders: jest.fn(),
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue(mockHtmlContent),
      close: jest.fn()
    };

    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);

    const details = await scraper._getMovieDetails(movie);
    
    expect(details).toMatchObject({
      title: 'Test Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2023',
      rating: '8.5',
      directors: 'John Doe',
      actors: 'Jane Doe, Bob Smith',
      plot: 'Detailed plot'
    });

    // Test cache
    const cachedDetails = await scraper._getMovieDetails(movie);
    expect(cachedDetails).toEqual(details);
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
});

  test('searchMovies orchestrates scraping', async () => {
    const mockPage = {
      setExtraHTTPHeaders: jest.fn(),
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue(`
        <li class="ipc-metadata-list-summary-item">
          <div class="ipc-title__text">1. Test Movie</div>
          <a class="ipc-title-link-wrapper" href="/title/tt0000001/"></a>
          <span class="sc-2bbfc9e9-7">2023</span>
          <div class="ipc-rating-star--rating">8.5</div>
          <div class="ipc-html-content-inner-div">A test plot</div>
        </li>
      `),
      evaluate: jest.fn().mockResolvedValue(1),
      close: jest.fn(),
      setViewport: jest.fn()
    };

    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);

    const movies = await scraper.searchMovies('', 'action', 1, 'db');
    expect(movies).toHaveLength(1);
    expect(movies[0]).toMatchObject({
      title: 'Test Movie',
      url: 'https://www.imdb.com/title/tt0000001/',
      year: '2023',
      rating: '8.5',
      plot: 'A test plot'
    });
    expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
  });
});