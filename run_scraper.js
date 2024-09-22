require('dotenv').config();
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { Parser } = require('json2csv');
const { createObjectCsvWriter } = require('csv-writer');
const pLimit = require('p-limit');
const clc = require('cli-color');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, 'scraper.log') })
  ]
});



let startTime;

function parseHTML(html, saasName) {
  const $ = cheerio.load(html);
  const data = {
    url: `https://www.saashub.com/${saasName}`,
    LogoURL: $('figure.image.is-96x96 img').attr('src'),
    CompanyName: $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > h2 > span').text().trim(),
    Website: (() => {
      const websiteLink = $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > div.space-y-4.mt-4 > div.flex.mt-4 > div.flex-1.flex.flex-wrap.gap-2 > a.btn.btn--hero.btn--success.track-event').attr('href');
      if (websiteLink) return websiteLink;
      const websiteButton = $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > div.space-y-4.mt-4 > div.flex.mt-4 > div.flex-1.flex.flex-wrap.gap-2 > button.btn.btn--hero.btn--success.track-event');
      if (websiteButton.length) {
        const onclickAttr = websiteButton.attr('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/window\.open\('(.+?)'\)/);
          if (match) return match[1];
        }
      }
      return null;
    })(),
    CompanyDescription: $('h3.text-lg.font-normal.mb-2').text().trim(),
    rating: $('.service-rating b').text() || '0',
    'Number of reviews': (() => {
      const reviewText = $('.service-rating span').text().trim();
      if (reviewText === '1 review)') return 1;
      if (reviewText === '') return 0;
      return parseInt(reviewText.replace('(', '').replace(' reviews)', '')) || 0;
    })(),
    pricingText: $('div[itemprop="offers"] ul li')
      .map((i, el) => $(el).text().trim())
      .filter((text) => text !== "Official Pricing")
      .get().join('; '),
    pricingURL: (() => {
      const pricingList = $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > div.space-y-4.mt-4 > div:nth-child(2) > ul');
      let pricingURL = null;
      pricingList.find('li').each((index, element) => {
        const anchor = $(element).find('a');
        if (anchor.length && anchor.text().includes('Pricing')) {
          pricingURL = anchor.attr('href');
          return false; // Break the loop
        }
      });
      return pricingURL ? encodeURI(pricingURL) : null;
    })(),
    platforms: $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > div.space-y-4.mt-4 > div:nth-child(3) > ul li span')
      .map((i, el) => $(el).text().trim())
      .get().join(', '),
    AlternativesPageURL: (() => {
      const alternativesLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).text().includes('Alternatives')).attr('href');
      return alternativesLink ? `https://www.saashub.com${alternativesLink}` : null;
    })(),
    StatusPageURL: (() => {
      const statusLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).text().includes('Status')).attr('href');
      if (!statusLink) return null;
      return statusLink.startsWith('http') ? statusLink : `https://www.saashub.com${statusLink}`;
    })(),
    RSSFeedURL: (() => {
      const blogLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.includes('Blog')).attr('href');
      if (!blogLink) return null;
      return blogLink.startsWith('http') ? blogLink : `https://www.saashub.com${blogLink}`;
    })(),
    LinkedIn: (() => {
      const linkedInLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('linkedin')).attr('href');
      if (!linkedInLink) return null;
      return linkedInLink.startsWith('http') ? linkedInLink : `https://www.saashub.com${linkedInLink}`;
    })(),
    GooglePlayURL: (() => {
      const googlePlayLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('google play')).attr('href');
      if (!googlePlayLink) return null;
      return googlePlayLink.startsWith('http') ? googlePlayLink : `https://www.saashub.com${googlePlayLink}`;
    })(),
    GithubURL: (() => {
      const githubLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('github')).attr('href');
      if (!githubLink) return null;
      return githubLink.startsWith('http') ? githubLink : `https://www.saashub.com${githubLink}`;
    })(),
    FacebookURL: (() => {
      const facebookLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('facebook')).attr('href');
      if (!facebookLink) return null;
      return facebookLink.startsWith('http') ? facebookLink : `https://www.saashub.com${facebookLink}`;
    })(),
    InstagramURL: (() => {
      const instagramLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('instagram')).attr('href');
      if (!instagramLink) return null;
      return instagramLink.startsWith('http') ? instagramLink : `https://www.saashub.com${instagramLink}`;
    })(),
    CrunchbaseURL: (() => {
      const crunchbaseLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('crunchbase')).attr('href');
      if (!crunchbaseLink) return null;
      return crunchbaseLink.startsWith('http') ? crunchbaseLink : `https://www.saashub.com${crunchbaseLink}`;
    })(),
    TwitterURL: (() => {
      const twitterLink = $('div.flex-1.flex.flex-wrap.gap-2 a').filter((i, el) => $(el).attr('title')?.toLowerCase().includes('twitter')).attr('href');
      if (!twitterLink) return null;
      return twitterLink.startsWith('http') ? twitterLink : `https://www.saashub.com${twitterLink}`;
    })(),
    'Verified?': $('span.badge-verified').length > 0 ? 'Yes' : 'No',
    tags: $('.tag-links a').map((i, el) => $(el).text().trim()).get().join(', '),
    Categories: (() => {
      const category = $('nav.breadcrumbs ol li:nth-child(2) a span').text().trim();
      const relatedCategory = $('nav.breadcrumbs ol li:nth-child(3) a span').text().trim();
      if (category && relatedCategory) {
        return `${category}, ${relatedCategory}`;
      } else {
        return category || relatedCategory || null;
      }
    })(),
    Img1: $('figure.screenshot img').attr('src'),
    Img2: $('figure.screenshot:nth-child(2) img').attr('src') || null,
    Img3: $('figure.screenshot:nth-child(3) img').attr('src') || null,
    Img4: $('figure.screenshot:nth-child(4) img').attr('src') || null,
    Img5: $('figure.screenshot:nth-child(5) img').attr('src') || null,
    'Features & Specs': $('#features > ol').html()?.trim() || null,
    Video1: $('.grid > div:nth-child(1) lite-youtube').attr('videoid')
      ? `https://www.youtube.com/watch?v=${$('.grid > div:nth-child(1) lite-youtube').attr('videoid')}`
      : null,
    Video2: $('.grid > div:nth-child(2) lite-youtube').attr('videoid')
      ? `https://www.youtube.com/watch?v=${$('.grid > div:nth-child(2) lite-youtube').attr('videoid')}`
      : null,
    Video3: $('.grid > div:nth-child(3) lite-youtube').attr('videoid')
      ? `https://www.youtube.com/watch?v=${$('.grid > div:nth-child(3) lite-youtube').attr('videoid')}`
      : null,
    Video4: $('.grid > div:nth-child(4) lite-youtube').attr('videoid')
      ? `https://www.youtube.com/watch?v=${$('.grid > div:nth-child(4) lite-youtube').attr('videoid')}`
      : null,
    Video5: $('.grid > div:nth-child(5) lite-youtube').attr('videoid')
      ? `https://www.youtube.com/watch?v=${$('.grid > div:nth-child(5) lite-youtube').attr('videoid')}`
      : null,
    'External source: Title1': $('.boxed#external-reviews .space-y-2 strong a').first().text().trim(),
    'External source: Text1': $('.boxed#external-reviews .space-y-2 .description').first().text().trim(),
    'External source: AnchorText1': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').first().text().trim(),
    'External source: AnchorLink1': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').first().attr('href'),
    'External source: Title2': $('.boxed#external-reviews .space-y-2 strong a').eq(1).text().trim() || null,
    'External source: Text2': $('.boxed#external-reviews .space-y-2 .description').eq(1).text().trim() || null,
    'External source: AnchorText2': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').eq(1).text().trim() || null,
    'External source: AnchorLink2': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').eq(1).attr('href') || null,
    'External source: Title3': $('.boxed#external-reviews .space-y-2 strong a').eq(2).text().trim() || null,
    'External source: Text3': $('.boxed#external-reviews .space-y-2 .description').eq(2).text().trim() || null,
    'External source: AnchorText3': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').eq(2).text().trim() || null,
    'External source: AnchorLink3': $('.boxed#external-reviews .space-y-2 .text-sm.text-links.italic b a').eq(2).attr('href') || null,
    'Q&A': $('.boxed.boxed--more-space#questions ol').html()?.trim() || null,
    'Social Recommendations & Mentions Text': $('#mentions > ul').prop('outerHTML') || null,
  };
  return data;
}


async function fetchSaaSData(url, retries = 3) {
  const proxyHost = process.env.PROXY_HOST || 'shared-datacenter.geonode.com';
  const proxyPort = Math.floor(Math.random() * 11 + 9000).toString(); //process.env.PROXY_PORT 
  const proxyUser = process.env.PROXY_USER || 'geonode_9JCPZiW1CD';
  const proxyPass = process.env.PROXY_PASS || 'e6c374e4-13ed-4f4a-9ed1-8f31e7920485';

  const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const httpsAgent = new HttpsProxyAgent(proxyUrl);

  let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: url,
      headers: { 
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
          'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
          'cache-control': 'no-cache', 
          'dnt': '1', 
          'pragma': 'no-cache', 
          'priority': 'u=0, i', 
          'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"', 
          'sec-ch-ua-mobile': '?0', 
          'sec-ch-ua-platform': '"Windows"', 
          'sec-fetch-dest': 'document', 
          'sec-fetch-mode': 'navigate', 
          'sec-fetch-site': 'same-origin', 
          'sec-fetch-user': '?1', 
          'upgrade-insecure-requests': '1', 
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', 
      },
      validateStatus: function (status) {
          return status < 500; // Resolve only if the status code is less than 500
      },
      httpsAgent: httpsAgent, // Add the proxy agent to the config
      timeout: 10000, // Add 10 seconds timeout
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          const response = await axios.request(config);
          if (response.status === 200) {
              const saasName = url.split('/').pop();
              const parsedData = parseHTML(response.data, saasName);
              return parsedData;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
      } catch (error) {
          if (attempt === retries) {
              if (error.response) {
                  throw new Error(`HTTP error! status: ${error.response.status}`);
              } else if (error.request) {
                  throw new Error('No response received from the server');
              } else {
                  throw error;
              }
          }
          console.log(clc.yellow(`Attempt ${attempt} failed for ${url}. Retrying...`));
          await delay(DELAY * attempt); // Exponential backoff
      }
  }
}

  
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  async function saveToJSON(data, filePath) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
  
  async function appendToCSV(data, filePath) {
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: Object.keys(data[0]).map(key => ({ id: key, title: key })),
      append: fileExists
    });
  
    await csvWriter.writeRecords(data);
  }
  
  
  async function ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
  
  function sanitySaaSOk(data) {
    const requiredFields = [
      { name: 'Website', errorMsg: 'Website URL is missing' },
      { name: 'CompanyDescription', errorMsg: 'Company description is missing' },
      { name: 'AlternativesPageURL', errorMsg: 'Alternatives page URL is missing' },
      { name: 'StatusPageURL', errorMsg: 'Status page URL is missing' }
    ];
  
    const errors = [];
  
    for (const field of requiredFields) {
      if (!data[field.name] || data[field.name] === '') {
        errors.push(field.errorMsg);
      }
    }
  
    // Additional check for Website field to ensure it's a valid URL
    if (data.Website && !isValidURL(data.Website)) {
      errors.push('Website URL is not valid');
    }
  
    if (errors.length > 0) {
      return {
        isValid: false,
        errors: errors
      };
    }
  
    return {
      isValid: true
    };
  }
  
  // Helper function to validate URL
  function isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function processUrl(url) {
    try {
      const data = await fetchSaaSData(url);
      const sanityCheckResult = sanitySaaSOk(data);
      if (!sanityCheckResult.isValid) {
        console.error(clc.red(`Sanity check failed for ${url}: ${sanityCheckResult.errors.join(', ')}`));
        return { data: null, error: { url, error: `Sanity check failed: ${sanityCheckResult.errors.join(', ')}` } };
      }
      return { data, error: null };
    } catch (error) {
      console.error(clc.red(`Error processing ${url}: ${error.message}`));
      return { data: null, error: { url, error: error.message } };
    }
  }
  
  
  
 
  
  const MAX_URLS = 0
  const TEST_URLS = [
//  "https://www.saashub.com/shopify"  ,
//  "https://www.saashub.com/similarweb"


];


const BATCH_SIZE = 100;
const RECORDS_PER_FILE = 100;
const RATE_LIMIT = 30;
const DELAY = 10;
async function getLastProcessedInfo(jsonResultDir) {
  const infoPath = path.join(jsonResultDir, 'last_processed_info.json');
  try {
    const infoData = await fs.readFile(infoPath, 'utf-8');
    return JSON.parse(infoData);
  } catch (error) {
    return { lastUrl: null, processedCount: 0 };
  }
}
function getCSVHeaders(data) {
  if (data.length === 0) return '';
  return Object.keys(data[0]).join(',') + '\n';
}

async function saveData(data, jsonResultDir, csvResultDir, fileIndex) {
  const jsonPath = path.join(jsonResultDir, `saas_data_${fileIndex}.json`);
  const csvPath = path.join(csvResultDir, `saas_data_${fileIndex}.csv`);

  // Save JSON data
  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
  
  // Prepare CSV content with headers
  const csvHeaders = getCSVHeaders(data);
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
  });

  // Save CSV data
  await csvWriter.writeRecords(data);

  console.log(clc.green(`Saved file: saas_data_${fileIndex}`));
}

async function getUrlsToScrape(sitemapDir) {
  const allUrlsFile = await fs.readFile(path.join(sitemapDir, 'all_urls.json'), 'utf-8');
  const allUrls = MAX_URLS ? JSON.parse(allUrlsFile).slice(0, MAX_URLS) : JSON.parse(allUrlsFile);
  console.log(clc.blue(`Using ${allUrls.length} URLs for processing.`));
  return [...new Set(allUrls)];
}
async function run_scraper() {
  console.log(clc.green.bold('Starting the simplified large-scale SaaS scraping process...'));
  
  const jsonResultDir = path.join(__dirname, 'scraping_results');
  const csvResultDir = path.join(__dirname, 'scraping_results');
  const sitemapDir = path.join(__dirname, 'sitemap_urls');
  
  try {
    await ensureDirectoryExists(jsonResultDir);
    await ensureDirectoryExists(csvResultDir);
    
    let urlsToScrape = await getUrlsToScrape(sitemapDir);
    const { lastUrl, processedCount: startProcessedCount } = await getLastProcessedInfo(jsonResultDir);

    let startIndex = lastUrl ? urlsToScrape.indexOf(lastUrl) + 1 : 0;
    if (startIndex === -1) startIndex = 0;

    const totalUrls = urlsToScrape.length;
    let allErrors = [];
    let processedCount = startProcessedCount;
    let currentData = [];

    const startTime = Date.now();
    
    for (let i = startIndex; i < totalUrls; i += BATCH_SIZE) {
      const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
      const { processedInBatch, errors, currentData: newData } = await processBatch(batch, i, totalUrls, jsonResultDir, csvResultDir, processedCount, startTime);
      
      allErrors.push(...errors);
      processedCount += processedInBatch;
      currentData.push(...newData);

      // Save any full batches of data
      while (currentData.length >= RECORDS_PER_FILE) {
        const fileIndex = Math.floor(processedCount / RECORDS_PER_FILE) - 1;
        await saveData(currentData.slice(0, RECORDS_PER_FILE), jsonResultDir, csvResultDir, fileIndex);
        currentData = currentData.slice(RECORDS_PER_FILE);
      }

      // Update last processed info
      await saveLastProcessedInfo(jsonResultDir, urlsToScrape[i + processedInBatch - 1], processedCount);
    }

    // Save any remaining data
    if (currentData.length > 0) {
      const fileIndex = Math.floor(processedCount / RECORDS_PER_FILE);
      await saveData(currentData, jsonResultDir, csvResultDir, fileIndex);
    }

    console.log(clc.green.bold('\nAll URLs processed.'));
    logFinalStats(startTime, totalUrls - startIndex, allErrors);
  } catch (error) {
    console.error(clc.red.bold('An unexpected error occurred during the scraping process:'), error);
  }
}



async function saveLastProcessedInfo(jsonResultDir, lastUrl, processedCount) {
  const infoPath = path.join(jsonResultDir, 'last_processed_info.json');
  const infoData = JSON.stringify({ lastUrl, processedCount });
  await fs.writeFile(infoPath, infoData);
}
async function getResumeInfo(jsonResultDir, urlsToScrape) {
  try {
    const { url: lastProcessedUrl, fileIndex: startFileIndex } = await getLastProcessedInfo(jsonResultDir);
    let startIndex = 0;
    if (lastProcessedUrl) {
      const lastProcessedIndex = urlsToScrape.indexOf(lastProcessedUrl);
      if (lastProcessedIndex !== -1) {
        if (lastProcessedIndex === urlsToScrape.length - 1) {
          console.log(clc.yellow('All URLs in the current set have already been processed.'));
          console.log(clc.green.bold('Scraping process complete. No new URLs to process.'));
          process.exit(0);
        }
        startIndex = lastProcessedIndex + 1;
        console.log(clc.magenta(`Resuming from URL: ${urlsToScrape[startIndex]}`));
      } else {
        console.log(clc.yellow(`Last processed URL not found in current set. Starting from the beginning.`));
      }
    }
    return { startIndex, currentFileIndex: startFileIndex };
  } catch (error) {
    console.log(clc.yellow('No resume information found. Starting from the beginning.'));
    return { startIndex: 0, currentFileIndex: 0 };
  }
}
async function processBatch(batch, batchStartIndex, totalUrls, jsonResultDir, csvResultDir, processedCount, startTime) {
  const limit = pLimit(RATE_LIMIT);
  let currentData = [];
  let errors = [];
  let localProcessedCount = 0;

  const processingPromises = batch.map((url, index) => {
    return limit(async () => {
      try {
        const result = await processUrl(url);
        const overallIndex = batchStartIndex + index;
        
        if (result.data) {
          currentData.push(result.data);
          localProcessedCount++;

          if (currentData.length >= RECORDS_PER_FILE) {
            const fileIndex = Math.floor((processedCount + localProcessedCount) / RECORDS_PER_FILE) - 1;
            await saveData(currentData, jsonResultDir, csvResultDir, fileIndex);
            currentData = [];
          }
        } else if (result.error) {
          errors.push(result.error);
        }

        // Log progress
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000;
        const currentProcessed = processedCount + localProcessedCount;
        const percentComplete = ((currentProcessed) / totalUrls * 100).toFixed(2);
        const estimatedTotalTime = (elapsedTime / currentProcessed) * totalUrls;
        const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);

        console.log(
          clc.cyan(`[${percentComplete}%] Processing URL ${currentProcessed}/${totalUrls}: ${url}`) +
          clc.yellow(` | Elapsed: ${formatTime(elapsedTime)}`) +
          clc.green(` | Remaining: ${formatTime(remainingTime)}`)
        );

        // Add the requested logging feature
        if (currentProcessed % 100 === 0) {
          const logMessage = `[${percentComplete}%] Processed ${currentProcessed}/${totalUrls} URLs | Elapsed: ${formatTime(elapsedTime)} | Remaining: ${formatTime(remainingTime)}`;
          logger.info(logMessage);
        }

        return result;
      } catch (error) {
        errors.push({ url, error: error.message });
        return { data: null, error: { url, error: error.message } };
      }
    });
  });

  await Promise.all(processingPromises);

  return { processedInBatch: localProcessedCount, errors, currentData };
}



function logFinalStats(startTime, processedUrls, allErrors) {
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(clc.blue(`Total time taken: ${formatTime(totalTime)}`));
  console.log(clc.blue(`Total SaaS products successfully processed: ${processedUrls - allErrors.length}`));
  
  if (allErrors.length > 0) {
    console.log(clc.red('\nErrors encountered:'));
    allErrors.forEach(({ url, error }) => {
      console.log(clc.red(`- ${url}: ${error}`));
    });
    
    const errorLogPath = path.join(__dirname, 'error_log.json');
    fs.writeFile(errorLogPath, JSON.stringify(allErrors, null, 2))
      .then(() => console.log(clc.yellow(`Error log saved to: ${errorLogPath}`)))
      .catch(err => console.error(clc.red(`Failed to save error log: ${err.message}`)));
  }
}
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

  
module.exports = run_scraper;
