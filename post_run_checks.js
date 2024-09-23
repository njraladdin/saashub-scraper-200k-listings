const fs = require('fs');
const path = require('path');

const postRunChecks = () => {
  const scrapingResultsDir = path.join(__dirname, 'scraping_results');
  const sitemapFile = path.join(__dirname, 'sitemap_urls', 'all_urls.json');

  // Read and parse the sitemap file
  const sitemapUrls = JSON.parse(fs.readFileSync(sitemapFile, 'utf8'));

  // Get the list of URLs from the sitemap
  const allUrls = sitemapUrls.map(url => url.trim());

  // Read and parse all JSON files in the scraping_results directory
  const scrapingFiles = fs.readdirSync(scrapingResultsDir).filter(file => file.endsWith('.json'));
  const scrapedUrls = new Set();

  scrapingFiles.forEach(file => {
    const filePath = path.join(scrapingResultsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.forEach(entry => {
      if (entry.url) {
        scrapedUrls.add(entry.url.trim());
      }
    });
  });

  // Calculate the percentage of URLs that were downloaded and missing
  const downloadedCount = allUrls.filter(url => scrapedUrls.has(url)).length;
  const totalUrls = allUrls.length;
  const downloadedPercentage = (downloadedCount / totalUrls) * 100;
  const missingPercentage = 100 - downloadedPercentage;

  console.log(`Downloaded URLs: ${downloadedPercentage.toFixed(2)}%`);
  console.log(`Missing URLs: ${missingPercentage.toFixed(2)}%`);
}

postRunChecks()