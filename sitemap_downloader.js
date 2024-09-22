const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const xml2js = require('xml2js');
const readline = require('readline');

const sitemap_xml_files = './sitemap_xml_files';
const sitemap_urls = './sitemap_urls';

// Ensure the output directories exist
[sitemap_xml_files, sitemap_urls].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Hardcoded sitemap URLs
const sitemapUrls = [
  'https://www.saashub.com/sitemaps/sitemap1.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap2.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap3.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap4.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap5.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap6.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap7.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap8.xml.gz',
  'https://www.saashub.com/sitemaps/sitemap9.xml.gz'
];

// Function to download and process a sitemap
function processSitemap(url, index) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(sitemap_xml_files, `sitemap${index}.xml`);
    
    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`File ${outputPath} already exists. Skipping download.`);
      resolve(outputPath);
      return;
    }

    https.get(url, (response) => {
      const gunzip = zlib.createGunzip();
      const buffer = [];

      response.pipe(gunzip);

      gunzip.on('data', (chunk) => {
        buffer.push(chunk);
      });

      gunzip.on('end', () => {
        const decompressed = Buffer.concat(buffer).toString();
        fs.writeFileSync(outputPath, decompressed);
        console.log(`Saved ${outputPath}`);
        resolve(outputPath);
      });

      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

// Function to extract URLs from XML file
function extractUrls(xmlFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(xmlFilePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      xml2js.parseString(data, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const urls = result.urlset.url.map(url => url.loc[0]);
        resolve(urls);
      });
    });
  });
}

// Function to save URLs as JSON
function saveUrlsAsJson(urls, index) {
  const jsonPath = path.join(sitemap_urls, `urls${index}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(urls, null, 2));
  console.log(`Saved ${jsonPath}`);
}

// Function to process URL
function processUrl(url) {
  if (url.includes('-alternatives')) {
    return url.replace('-alternatives', '');
  }
  if (url.includes('-status')) {
    return url.replace('-status', '');
  }
  return url;
}
// Function to merge all JSON files, apply processing, and remove duplicates
async function mergeJsonFilesWithProcessing() {
  const jsonFiles = fs.readdirSync(sitemap_urls).filter(file => file.endsWith('.json'));
  const urlSet = new Set();
  
  for (const file of jsonFiles) {
    const filePath = path.join(sitemap_urls, file);
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.includes('"https://')) {
        const url = line.trim().replace(/[",]/g, '');
        const processedUrl = processUrl(url);
        urlSet.add(processedUrl);
      }
    }
  }

  const uniqueUrls = Array.from(urlSet)
    .filter(url => url !== 'https://www.saashub.com' && url !== 'https://www.saashub.com/status-pages')
    .filter(url => !(url.includes('best-') && url.includes('-software'))) // Filter out URLs containing both 'best-' and '-software'
    .filter(url => !url.includes('sitemap/')); // Filter out URLs containing 'sitemap/'

  fs.writeFileSync(path.join(sitemap_urls, 'all_urls.json'), JSON.stringify(uniqueUrls, null, 2));

  console.log(`Total unique URLs after processing: ${uniqueUrls.length}`);
  return uniqueUrls.length;
}
// Main function to orchestrate the process
async function main() {
  for (let i = 0; i < sitemapUrls.length; i++) {
    try {
      const xmlPath = await processSitemap(sitemapUrls[i], i + 1);
      const urls = await extractUrls(xmlPath);
      saveUrlsAsJson(urls, i + 1);
    } catch (error) {
      console.error(`Error processing ${sitemapUrls[i]}:`, error);
    }
  }

  const totalUrls = await mergeJsonFilesWithProcessing();
  console.log(`Process completed. Total unique URLs after processing: ${totalUrls}`);
}

// Run the script
main();