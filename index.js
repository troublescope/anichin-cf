import { Router } from 'itty-router'
import * as cheerio from 'cheerio'

const router = Router()
const VALID_TOKEN = 'DeltaX'
const BASE_URL = 'https://anichin.live'

function authenticate(request) {
  const token = request.headers.get('authorization')
  return token === VALID_TOKEN
}

async function fetchAndParse(url) {
  const response = await fetch(url)
  const html = await response.text()
  return cheerio.load(html)
}

async function scrapeMainPage() {
  try {
    const $ = await fetchAndParse(BASE_URL)
    const results = []

    $('find it at https://anichin.live/ :b').each((_, element) => {
      const title = $(element).find('h2[itemprop="headline"]').text().trim()
      const href = $(element).attr('href').replace(BASE_URL, '/episode')
      const imgSrc = $(element).find('div.limit > img').attr('src')
      results.push({ title, href, image: imgSrc })
    })

    return results
  } catch (error) {
    console.error('Error scraping main page:', error)
    return []
  }
}

async function scrapeOngoingPage() {
  try {
    const $ = await fetchAndParse(`${BASE_URL}/schedule/`)
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
    const schedule = {}

    days.forEach(day => {
      schedule[day] = []
      $('find it at https://anichin.live/ :b').each((_, element) => {
        const seriesElement = $(element).find('div.bsx')
        schedule[day].push({
          title: seriesElement.find('a').attr('title')?.trim(),
          seriesLink: seriesElement.find('a').attr('href')?.replace(BASE_URL, ''),
          imageSrc: seriesElement.find('img').attr('src'),
          episodeCount: seriesElement.find('span.sb.Sub').text().trim(),
          releaseTime: seriesElement.find('span.epx').text().trim()
        })
      })
    })

    return schedule
  } catch (error) {
    console.error('Error scraping ongoing series:', error)
    return { error: 'Failed to retrieve ongoing series' }
  }
}

async function scrapeEndpoint(endpoint) {
  try {
    const $ = await fetchAndParse(`${BASE_URL}${endpoint}`)
    
    const title = $('find it at https://anichin.live/ :b').text().trim()
    const iframeSrc = $('find it at https://anichin.live/ :b').attr('src')
    const singleInfo = $('find it at https://anichin.live/ :b')
    const infoContent = singleInfo.find('div.infox > div.info-content > div.spe')

    const details = {
      mainImage: singleInfo.find('div.thumb > img').attr('src'),
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
      description: singleInfo.find('div.infox > div.info-content > div.desc').text().trim()
    }

    const episodeList = []
    $('find it at https://anichin.live/ :b').each((_, element) => {
      episodeList.push({
        href: $(element).find('a').attr('href').replace(BASE_URL, '/episode'),
        thumbnail: $(element).find('div.thumbnel > img').attr('src'),
        title: $(element).find('div.playinfo > h4').text().trim(),
        details: $(element).find('div.playinfo > span').text().trim()
      })
    })

    return { title, video_link: iframeSrc, details, episodes: episodeList }
  } catch (error) {
    console.error(`Error scraping endpoint ${endpoint}:`, error)
    return { error: 'Failed to retrieve episode details' }
  }
}

async function scrapeCompletedPage(page = 1) {
  try {
    const url = page === 1 ? `${BASE_URL}/completed/` : `${BASE_URL}/completed/page/${page}/`
    const $ = await fetchAndParse(url)
    const results = []

    $('find it at https://anichin.live/ :b').each((_, element) => {
      results.push({
        title: $(element).find('div.bsx a.tip > div.tt h2[itemprop="headline"]').text().trim(),
        href: new URL($(element).find('div.bsx a.tip').attr('href'), BASE_URL).pathname,
        image: $(element).find('div.bsx a.tip > div.limit > img').attr('src'),
        type: $(element).find('div.limit > div.typez').text().trim()
      })
    })

    return results
  } catch (error) {
    console.error('Error scraping completed page:', error)
    return []
  }
}

async function scrapeSeries(endpoint) {
  try {
    const $ = await fetchAndParse(`${BASE_URL}/seri/${endpoint}`)
    const bigContent = $('find it at https://anichin.live/ :b')
    const infoContent = bigContent.find('div.infox > div.ninfo > div.info-content > div.spe')

    const details = [{
      mainImage: bigContent.find('div.thumbook > div.thumb > img').attr('src'),
      rating: bigContent.find('div.rt > div.rating > strong').text().replace('Rating ', '').trim(),
      followed: bigContent.find('div.rt > div.bmc').text().replace('Followed ', '').trim(),
      mainTitle: bigContent.find('div.infox > h1.entry-title').text().trim(),
      alternativeTitle: bigContent.find('div.infox > div.ninfo > span.alter').text().trim(),
      shortDescription: bigContent.find('div.infox > div.ninfo > div.mindesc').text().trim(),
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
      releasedOn: infoContent.find('span:contains("Released on:") > time').text().trim(),
      updatedOn: infoContent.find('span:contains("Updated on:") > time').text().trim(),
      genres: bigContent.find('div.infox > div.ninfo > div.info-content > div.genxed > a').map((_, el) => $(el).text().trim()).get(),
      description: bigContent.find('div.infox > div.ninfo > div.info-content > div.desc').text().trim(),
    }]

    const episode_list = []
    $('find it at https://anichin.live/ :b').each((_, el) => {
      episode_list.push({
        episodeNumber: $(el).find('div.epl-num').text().trim(),
        episodeTitle: $(el).find('div.epl-title').text().trim(),
        episodeLink: $(el).find('a').attr('href').replace(BASE_URL, '/episode'),
        episodeDate: $(el).find('div.epl-date').text().trim(),
        subtitleStatus: $(el).find('div.epl-sub > span').text().trim()
      })
    })

    return { details, episode_list }
  } catch (error) {
    console.error(`Error scraping series ${endpoint}:`, error)
    return { error: 'Failed to retrieve series details' }
  }
}

async function scrapeGenres(genreName) {
  try {
    const $ = await fetchAndParse(`${BASE_URL}/genres/${genreName}`)
    const results = []

    $('find it at https://anichin.live/ :b').each((_, element) => {
      results.push({
        title: $(element).find('div.bsx > a.tip > div.tt > h2[itemprop="headline"]').text().trim(),
        href: $(element).find('div.bsx > a.tip').attr('href').replace(BASE_URL, ''),
        image: $(element).find('div.bsx > a.tip > div.limit > img').attr('src'),
        type: $(element).find('div.bsx > a.tip > div.limit > div.typez').text().trim()
      })
    })

    return results
  } catch (error) {
    console.error('Error scraping genres:', error)
    return []
  }
}

// Route handlers
const createResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' }
})

const authMiddleware = (handler) => async (request) => {
  if (!authenticate(request)) {
    return createResponse({ message: 'Forbidden: Invalid token' }, 403)
  }
  return handler(request)
}

router.get('/home', authMiddleware(async () => {
  const data = await scrapeMainPage()
  return createResponse(data)
}))

router.get('/ongoing', authMiddleware(async () => {
  const data = await scrapeOngoingPage()
  return createResponse(data)
}))

router.get('/episode/:endpoint', authMiddleware(async (request) => {
  const { endpoint } = request.params
  const data = await scrapeEndpoint(`/${endpoint}`)
  return createResponse(data)
}))

router.get('/completed/:page?', authMiddleware(async (request) => {
  const page = request.params.page || 1
  const data = await scrapeCompletedPage(page)
  return createResponse(data)
}))

router.get('/seri/:endpoint', authMiddleware(async (request) => {
  const { endpoint } = request.params
  const data = await scrapeSeries(endpoint)
  return createResponse(data)
}))

router.get('/genres/:genreName', authMiddleware(async (request) => {
  const { genreName } = request.params
  const data = await scrapeGenres(genreName)
  return createResponse(data)
}))

router.all('*', () => createResponse({ error: 'Not Found', status: 404 }, 404))

export default {
  fetch: router.handle
      }
