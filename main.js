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
  
  const RECORDS_PER_FILE = 10000;
  const RATE_LIMIT = 10;
  const DELAY = 10;
  





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
    //  await delay(DELAY);
      return { data, error: null };
    } catch (error) {
      console.error(clc.red(`Error processing ${url}: ${error.message}`));
      return { data: null, error: { url, error: error.message } };
    }
  }
  
  
  
  
  
  async function getLastProcessedInfo(jsonResultDir) {
    const files = await fs.readdir(jsonResultDir);
    const jsonFiles = files.filter(file => file.startsWith('saas_data_') && file.endsWith('.json'));
    
    if (jsonFiles.length === 0) return { url: null, fileIndex: 0, positionInFile: 0 };
  
    const lastFile = jsonFiles.sort().pop();
    const fileIndex = parseInt(lastFile.match(/saas_data_(\d+)\.json/)[1]);
    const data = JSON.parse(await fs.readFile(path.join(jsonResultDir, lastFile), 'utf-8'));
    
    if (data.length === 0) return { url: null, fileIndex, positionInFile: 0 };
    
    return { 
      url: data[data.length - 1].url, 
      fileIndex, 
      positionInFile: data.length
    };
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
      const allUrls = JSON.parse(allUrlsFile);
      console.log(clc.blue(`Using ${allUrls.length} URLs for processing.`));
      
     
      const urlsToScrape = [...new Set(allUrls)];
  
      const { url: lastProcessedUrl, fileIndex: startFileIndex, positionInFile: startPositionInFile } = await getLastProcessedInfo(jsonResultDir);
      let startIndex = 0;
      if (lastProcessedUrl) {
        const lastProcessedIndex = urlsToScrape.indexOf(lastProcessedUrl);
        if (lastProcessedIndex !== -1) {
          if (lastProcessedIndex === urlsToScrape.length - 1) {
            console.log(clc.yellow('All URLs in the current set have already been processed.'));
            console.log(clc.green.bold('Scraping process complete. No new URLs to process.'));
            return;
          }
          startIndex = lastProcessedIndex + 1;
          console.log(clc.magenta(`Resuming from URL: ${urlsToScrape[startIndex]}`));
        } else {
          console.log(clc.yellow(`Last processed URL not found in current set. Starting from the beginning.`));
        }
      }
  
      const totalUrls = urlsToScrape.length;
      const remainingUrls = totalUrls - startIndex;
      let allErrors = [];
  
      startTime = Date.now();
  
      const limit = pLimit(RATE_LIMIT);
      let currentFileIndex = startFileIndex;
      let currentFileData = [];
  
      // If resuming, load the existing data from the last file
      if (startPositionInFile > 0) {
        const lastFilePath = path.join(jsonResultDir, `saas_data_${currentFileIndex}.json`);
        currentFileData = JSON.parse(await fs.readFile(lastFilePath, 'utf-8'));
      }
  
      const processUrlsConcurrently = async () => {
        const promises = urlsToScrape.slice(startIndex).map((url, index) => 
          limit(() => processUrl(url, startIndex + index, totalUrls, startIndex))
        );
  
        let processedCount = 0;
        for await (const result of promises) {
          if (result.data) {
            currentFileData.push(result.data);
            if (currentFileData.length >= RECORDS_PER_FILE) {
              await saveToJSON(currentFileData, path.join(jsonResultDir, `saas_data_${currentFileIndex}.json`));
              await appendToCSV(currentFileData, path.join(csvResultDir, `saas_data_${currentFileIndex}.csv`));
              currentFileData = [];
              currentFileIndex++;
            }
          } else if (result.error) {
            allErrors.push(result.error);
          }
  
          processedCount++;
          // Progress update every 100 URLs
          if (processedCount % 100 === 0) {
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000;
            const percentComplete = (processedCount / remainingUrls * 100).toFixed(2);
            const estimatedTotalTime = (elapsedTime / processedCount) * remainingUrls;
            const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
  
            console.log(
              clc.cyan(`[${percentComplete}%] Processed ${processedCount}/${remainingUrls} URLs`) +
              clc.yellow(` | Elapsed: ${formatTime(elapsedTime)}`) +
              clc.green(` | Remaining: ${formatTime(remainingTime)}`)
            );
          }
        }
      };
  
      await processUrlsConcurrently();
  
      // Save any remaining data
      if (currentFileData.length > 0) {
        await saveToJSON(currentFileData, path.join(jsonResultDir, `saas_data_${currentFileIndex}.json`));
        await appendToCSV(currentFileData, path.join(csvResultDir, `saas_data_${currentFileIndex}.csv`));
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
  