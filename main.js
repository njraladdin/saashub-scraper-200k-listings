const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { Parser } = require('json2csv');
const { createObjectCsvWriter } = require('csv-writer');
const pLimit = require('p-limit');
const clc = require('cli-color');

function parseHTML(html, saasName) {
  const $ = cheerio.load(html);
  const data = {
    url: `https://www.saashub.com/${saasName}`,
    LogoURL: $('figure.image.is-96x96 img').attr('src'),
    CompanyName: $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > h2 > span').text().trim(),
    Website: $('a.track-event[data-ref="hero-pricing"]').attr('href'),
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
    pricingURL: $('a.track-event[data-ref="hero-pricing"]').attr('href'),
    platforms: $('body > section.hero.is-primary > div > div > div.flex-columns > div.flex-1 > div.space-y-4.mt-4 > div:nth-child(3) > ul li span')
      .map((i, el) => $(el).text().trim())
      .get().join(', '),
    AlternativesPageURL: $(`a[href="/${saasName}-alternatives"]`).attr('href') ? `https://www.saashub.com${$(`a[href="/${saasName}-alternatives"]`).attr('href')}` : null,
    StatusPageURL: 'https://status.netumo.com' + ($('a[href*="transferslot-status"]').attr('href') || ''),
    RSSFeedURL: $('a[href*="articles"]').attr('href'),
    LinkedIn: $('a[href*="linkedin.com"]').attr('href'),
    GooglePlayURL: $('a[href*="play.google.com"]').attr('href'),
    GithubURL: $('a[href*="github.com"]').attr('href') || null,
    FacebookURL: $('a[href*="facebook.com"]').attr('href') || null,
    InstagramURL: $('a[href*="instagram.com"]').attr('href') || null,
    CrunchbaseURL: $('a[href*="crunchbase.com"]').attr('href') || null,
    TwitterURL: $('a[href*="twitter.com"]').attr('href') || null,
    'Verified?': $('span.badge-verified').length > 0 ? 'Yes' : 'No',
    tags: $('.tag-links a').map((i, el) => $(el).text().trim()).get().join(', '),
    Categories: $('nav.breadcrumbs ol li:nth-child(2) a span').text().trim(),
    RelatedCategories: $('nav.breadcrumbs ol li:nth-child(3) a span').text().trim(),
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
    'External source: Title2': null,
    'External source: Text2': null,
    'External source: AnchorText2': null,
    'External source: AnchorLink2': null,
    'External source: Title3': null,
    'External source: Text3': null,
    'External source: AnchorText3': null,
    'External source: AnchorLink3': null,
    'Q&A': $('.boxed.boxed--more-space#questions ol').html()?.trim() || null
  };
  return data;
}


async function fetchSaaSData(url, retries = 3) {
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
        'referer': 'https://www.upwork.com/', 
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
      }
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
  
  const BATCH_SIZE = 100;
  const RECORDS_PER_FILE = 10000;
  const RATE_LIMIT = 5;
  const DELAY = 1000 / RATE_LIMIT;
  


  async function getLastProcessedUrl(jsonResultDir) {
    const files = await fs.readdir(jsonResultDir);
    const jsonFiles = files.filter(file => file.startsWith('saas_data_') && file.endsWith('.json'));
    
    if (jsonFiles.length === 0) return { url: null, fileIndex: 0 };
  
    const lastFile = jsonFiles.sort().pop();
    const fileIndex = parseInt(lastFile.match(/saas_data_(\d+)\.json/)[1]);
    const data = JSON.parse(await fs.readFile(path.join(jsonResultDir, lastFile), 'utf-8'));
    
    if (data.length === 0) return { url: null, fileIndex };
    
    return { url: data[data.length - 1].url, fileIndex };
  }
  let startTime;

  async function processUrl(url, index, totalUrls, startIndex) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000; // in seconds
    const adjustedIndex = index - startIndex;
    const adjustedTotal = totalUrls - startIndex;
    const percentComplete = ((adjustedIndex + 1) / adjustedTotal * 100).toFixed(2);
    const estimatedTotalTime = (elapsedTime / (adjustedIndex + 1)) * adjustedTotal;
    const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
  
    console.log(
      clc.cyan(`[${percentComplete}%] Processing URL ${adjustedIndex + 1}/${adjustedTotal}: ${url}`) +
      clc.yellow(` | Elapsed: ${formatTime(elapsedTime)}`) +
      clc.green(` | Remaining: ${formatTime(remainingTime)}`)
    );
  
    try {
      const data = await fetchSaaSData(url);
      await delay(DELAY);
      return { data, error: null };
    } catch (error) {
      console.error(clc.red(`Error processing ${url}: ${error.message}`));
      return { data: null, error: { url, error: error.message } };
    }
  }
  
  
  async function processBatch(urls, batchIndex, jsonResultDir, csvResultDir, totalUrls, startIndex, startFileIndex) {
    const limit = pLimit(RATE_LIMIT);
    const batchPromises = urls.map((url, index) => 
      limit(() => processUrl(url, startIndex + batchIndex * BATCH_SIZE + index, totalUrls, startIndex))
    );
  
    const batchResults = await Promise.all(batchPromises);
    const batchData = batchResults.filter(result => result.data).map(result => result.data);
    const batchErrors = batchResults.filter(result => result.error).map(result => result.error);
  
    if (batchData.length > 0) {
      const fileIndex = startFileIndex + Math.floor((batchIndex * BATCH_SIZE) / RECORDS_PER_FILE);
      const jsonFilePath = path.join(jsonResultDir, `saas_data_${fileIndex}.json`);
      const csvFilePath = path.join(csvResultDir, `saas_data_${fileIndex}.csv`);
  
      // Check if the file exists and read its content
      let existingData = [];
      try {
        existingData = JSON.parse(await fs.readFile(jsonFilePath, 'utf-8'));
      } catch (error) {
        // File doesn't exist or is empty, which is fine
      }
  
      // Append new data to existing data
      const updatedData = [...existingData, ...batchData];
  
      await saveToJSON(updatedData, jsonFilePath);
      await appendToCSV(batchData, csvFilePath);
    }
  
    return { batchData, batchErrors };
  }
  
  
  
  async function main() {
    console.log(clc.green.bold('Starting the large-scale SaaS scraping process...'));
    
    const jsonResultDir = path.join(__dirname, 'scraping_results');
    const csvResultDir = path.join(__dirname, 'scraping_results');
    const sitemapDir = path.join(__dirname, 'sitemap_urls');
    
    try {
      await ensureDirectoryExists(jsonResultDir);
      await ensureDirectoryExists(csvResultDir);
      
      const allUrlsFile = await fs.readFile(path.join(sitemapDir, 'all_urls.json'), 'utf-8');
      const allUrls = JSON.parse(allUrlsFile).slice(0, 100); // Only keep the first 100 URLs
      console.log(clc.blue(`Using ${allUrls.length} URLs for testing.`));
      
      const hardcodedUrls = [
        'https://www.saashub.com/netumo',
        'https://www.saashub.com/transferslot',
        'https://www.saashub.com/flippa',
        'https://www.saashub.com/shopify',
        'https://www.saashub.com/Arcadier',
        'https://www.saashub.com/odoo',
        'https://www.saashub.com/DirectIQ'
      ];
      const urlsToScrape = [...new Set([...hardcodedUrls, ...allUrls])];
  
      const { url: lastProcessedUrl, fileIndex: startFileIndex } = await getLastProcessedUrl(jsonResultDir);
      let startIndex = 0;
      if (lastProcessedUrl) {
        const lastProcessedIndex = urlsToScrape.indexOf(lastProcessedUrl);
        if (lastProcessedIndex !== -1) {
          if (lastProcessedIndex === urlsToScrape.length - 1) {
            console.log(clc.yellow('All URLs in the current set have already been processed.'));
            console.log(clc.green.bold('Scraping process complete. No new URLs to process.'));
            return; // Exit the function early
          }
          startIndex = lastProcessedIndex + 1;
          console.log(clc.magenta(`Resuming from URL: ${urlsToScrape[startIndex]}`));
        } else {
          console.log(clc.yellow(`Last processed URL not found in current set. Starting from the beginning.`));
        }
      }
  
      const totalUrls = urlsToScrape.length;
      const remainingUrls = totalUrls - startIndex;
      const totalBatches = Math.ceil(remainingUrls / BATCH_SIZE);
      let allErrors = [];
  
      startTime = Date.now();
  
      for (let i = 0; i < totalBatches; i++) {
        console.log(clc.yellow(`Processing batch ${i + 1} of ${totalBatches}`));
        const batchUrls = urlsToScrape.slice(startIndex + i * BATCH_SIZE, startIndex + (i + 1) * BATCH_SIZE);
        const { batchErrors } = await processBatch(batchUrls, i, jsonResultDir, csvResultDir, totalUrls, startIndex, startFileIndex);
        
        allErrors = allErrors.concat(batchErrors);
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(clc.green.bold('\nAll URLs processed.'));
      console.log(clc.blue(`Total time taken: ${formatTime(totalTime)}`));
      console.log(clc.blue(`Total SaaS products successfully processed: ${remainingUrls - allErrors.length}`));
      
      if (allErrors.length > 0) {
        console.log(clc.red('\nErrors encountered:'));
        allErrors.forEach(({ url, error }) => {
          console.log(clc.red(`- ${url}: ${error}`));
        });
        
        const errorLogPath = path.join(__dirname, 'error_log.json');
        await saveToJSON(allErrors, errorLogPath);
        console.log(clc.yellow(`Error log saved to: ${errorLogPath}`));
      }
    } catch (error) {
      console.error(clc.red.bold('An unexpected error occurred during the scraping process:'), error);
    }
  }

  
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  
  main();
  