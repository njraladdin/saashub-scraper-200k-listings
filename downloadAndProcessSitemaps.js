const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const xml2js = require('xml2js');
const readline = require('readline');

async function downloadAndProcessSitemaps(outputDir = './sitemap_data') {
  const XML_DIR = path.join(outputDir, 'xml');
  const URLS_DIR = path.join(outputDir, 'urls');

  // Create output directories
  [XML_DIR, URLS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  let sitemapIndex = 1;
  
  while (true) {
    const sitemapUrl = `https://www.saashub.com/sitemaps/sitemap${sitemapIndex}.xml.gz`;
    
    try {
      console.log(`Processing ${sitemapUrl}...`);
      const xmlPath = await downloadSitemap(sitemapUrl, sitemapIndex, XML_DIR);
      const urls = await extractUrls(xmlPath);
      await saveUrlsAsJson(urls, sitemapIndex, URLS_DIR);
      sitemapIndex++;
      
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.statusCode === 404) {
        console.log(`No more sitemaps found after sitemap${sitemapIndex-1}.xml.gz`);
        break;
      }
      console.error(`Error processing ${sitemapUrl}:`, error);
      break;
    }
  }

  // Merge and process all URLs
  return await mergeAndProcessUrls(URLS_DIR);
}

function downloadSitemap(url, index, xmlDir) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(xmlDir, `sitemap${index}.xml`);
    
    if (fs.existsSync(outputPath)) {
      console.log(`File ${outputPath} already exists. Skipping download.`);
      return resolve(outputPath);
    }

    https.get(url, (response) => {
      const gunzip = zlib.createGunzip();
      const chunks = [];

      response
        .pipe(gunzip)
        .on('data', chunk => chunks.push(chunk))
        .on('end', () => {
          const decompressed = Buffer.concat(chunks).toString();
          fs.writeFileSync(outputPath, decompressed);
          console.log(`Saved ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', reject);
    }).on('error', reject);
  });
}

function extractUrls(xmlFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(xmlFilePath, 'utf8', (err, data) => {
      if (err) return reject(err);

      xml2js.parseString(data, (err, result) => {
        if (err) return reject(err);
        const urls = result.urlset.url.map(url => url.loc[0]);
        resolve(urls);
      });
    });
  });
}

function saveUrlsAsJson(urls, index, urlsDir) {
  const jsonPath = path.join(urlsDir, `urls${index}.json`);
  return fs.promises.writeFile(jsonPath, JSON.stringify(urls, null, 2))
    .then(() => console.log(`Saved ${jsonPath}`));
}

function processUrl(url) {
  return url
    .replace('-alternatives', '')
    .replace('-status', '');
}

async function mergeAndProcessUrls(urlsDir) {
  const jsonFiles = fs.readdirSync(urlsDir).filter(file => file.endsWith('.json'));
  const urlSet = new Set();
  
  for (const file of jsonFiles) {
    const filePath = path.join(urlsDir, file);
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.includes('"https://')) {
        const url = line.trim().replace(/[",]/g, '');
        urlSet.add(processUrl(url));
      }
    }
  }

  const uniqueUrls = Array.from(urlSet).filter(url => 
    url !== 'https://www.saashub.com' &&
    url !== 'https://www.saashub.com/status-pages' &&
    !(url.includes('best-') && url.includes('-software')) &&
    !url.includes('sitemap/')
  );

  const outputPath = path.join(urlsDir, 'all_urls.json');
  await fs.promises.writeFile(outputPath, JSON.stringify(uniqueUrls, null, 2));
  console.log(`Total unique URLs after processing: ${uniqueUrls.length}`);

  return outputPath;
}

module.exports = downloadAndProcessSitemaps;