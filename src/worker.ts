import { Router } from 'itty-router';
import * as cheerio from 'cheerio';

const router = Router();
const VALID_TOKEN = 'DeltaX';
const BASE_URL = 'https://anichin.live';

type RequestWithParams = Request & { params: { [key: string]: string } };

// Authentication function
function authenticate(request: Request): boolean {
  const token = request.headers.get('authorization');
  return token === VALID_TOKEN;
}

// Fetch and parse HTML
async function fetchAndParse(url: string): Promise<cheerio.CheerioAPI> {
  const response = await fetch(url);
  const html = await response.text();
  return cheerio.load(html);
}

// Scraping functions
async function scrapeMainPage(): Promise<any[]> {
  try {
    const $ = await fetchAndParse(BASE_URL);
    const results: any[] = [];

    $('find it at https://anichin.live/ :b').each((_, element) => {
      const title = $(element).find('h2[itemprop="headline"]').text().trim();
      const href = $(element).attr('href')?.replace(BASE_URL, '/episode') || '';
      const imgSrc = $(element).find('div.limit > img').attr('src') || '';
      results.push({ title, href, image: imgSrc });
    });

    return results;
  } catch (error) {
    console.error('Error scraping main page:', error);
    return [];
  }
}

async function scrapeOngoingPage(): Promise<any> {
  try {
    const $ = await fetchAndParse(`${BASE_URL}/schedule/`);
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const schedule: Record<string, any[]> = {};

    days.forEach((day) => {
      schedule[day] = [];
      $('find it at https://anichin.live/ :b').each((_, element) => {
        const seriesElement = $(element).find('div.bsx');
        schedule[day].push({
          title: seriesElement.find('a').attr('title')?.trim() || '',
          seriesLink: seriesElement.find('a').attr('href')?.replace(BASE_URL, '') || '',
          imageSrc: seriesElement.find('img').attr('src') || '',
          episodeCount: seriesElement.find('span.sb.Sub').text().trim(),
          releaseTime: seriesElement.find('span.epx').text().trim(),
        });
      });
    });

    return schedule;
  } catch (error) {
    console.error('Error scraping ongoing series:', error);
    return { error: 'Failed to retrieve ongoing series' };
  }
}

async function scrapeEndpoint(endpoint: string): Promise<any> {
  try {
    const $ = await fetchAndParse(`${BASE_URL}${endpoint}`);
    const title = $('find it at https://anichin.live/ :b').text().trim();
    const iframeSrc = $('find it at https://anichin.live/ :b').attr('src') || '';
    const singleInfo = $('find it at https://anichin.live/ :b');
    const infoContent = singleInfo.find('div.infox > div.info-content > div.spe');

    const details = {
      mainImage: singleInfo.find('div.thumb > img').attr('src') || '',
      mainTitle: singleInfo.find('div.infox > div.infolimit > h2[itemprop="partOfSeries"]').text().trim(),
      alternativeTitle: singleInfo.find('div.infox > div.infolimit > span.alter').text().trim(),
      rating: singleInfo.find('div.infox > div.rating > strong').text().replace('Rating', '').trim(),
      status: infoContent.find('span:contains("Status:")').text().replace('Status:', '').trim(),
      network: infoContent.find('span:contains("Network:") > a').text().trim(),
      studio: infoContent.find('span:contains("Studio:") > a').text().trim(),
      released: infoContent.find('span:contains("Released:")').text().replace('Released:', '').trim(),
      duration: infoContent.find('span:contains("Duration:")').text().replace('Duration:', '').trim(),
      season: infoContent.find('span:contains("Season:") > a').text().trim(),
      country: infoContent.find('span:contains("Country:") > a').text().trim(),
      type: infoContent.find('span:contains("Type:")').text().replace('Type:', '').trim(),
      episodes: infoContent.find('span:contains("Episodes:")').text().replace('Episodes:', '').trim(),
      fansub: infoContent.find('span:contains("Fansub:")').text().replace('Fansub:', '').trim(),
      genres: singleInfo.find('div.infox > div.info-content > div.genxed > a').map((_, el) => $(el).text().trim()).get(),
      description: singleInfo.find('div.infox > div.info-content > div.desc').text().trim(),
    };

    const episodeList: any[] = [];
    $('find it at https://anichin.live/ :b').each((_, element) => {
      episodeList.push({
        href: $(element).find('a').attr('href')?.replace(BASE_URL, '/episode') || '',
        thumbnail: $(element).find('div.thumbnel > img').attr('src') || '',
        title: $(element).find('div.playinfo > h4').text().trim(),
        details: $(element).find('div.playinfo > span').text().trim(),
      });
    });

    return { title, video_link: iframeSrc, details, episodes: episodeList };
  } catch (error) {
    console.error(`Error scraping endpoint ${endpoint}:`, error);
    return { error: 'Failed to retrieve episode details' };
  }
}

// Utility functions and middleware
const createResponse = (data: any, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const authMiddleware = (handler: (request: RequestWithParams) => Promise<Response>) => async (request: RequestWithParams): Promise<Response> => {
  if (!authenticate(request)) {
    return createResponse({ message: 'Forbidden: Invalid token' }, 403);
  }
  return handler(request);
};

// Router endpoints
router.get('/home', authMiddleware(async () => {
  const data = await scrapeMainPage();
  return createResponse(data);
}));

router.get('/ongoing', authMiddleware(async () => {
  const data = await scrapeOngoingPage();
  return createResponse(data);
}));

router.get('/episode/:endpoint', authMiddleware(async (request: RequestWithParams) => {
  const { endpoint } = request.params;
  const data = await scrapeEndpoint(`/${endpoint}`);
  return createResponse(data);
}));

router.all('*', () => createResponse({ error: 'Not Found', status: 404 }, 404));

export default {
  fetch: router.handle,
};
