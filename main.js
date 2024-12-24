const downloadAndProcessSitemaps = require('./downloadAndProcessSitemaps');
const scrapeSaasHub = require('./scrapeSaasHub');
const { consolidateJsonToCsv } = require('./consolidateJsonToCsv');
const path = require('path');

// Run the scraper with proper setup
(async () => {
    try {
        console.log('Starting sitemap download and processing...');
        const sitemapDataDir = path.join(__dirname, 'sitemap_data2');
        const outputDir = path.join(__dirname, 'results');
        
        // First download and process sitemaps, get the path to all_urls.json
        const allUrlsFilePath = await downloadAndProcessSitemaps(sitemapDataDir);
        
        console.log('Starting scraper...');
        // Pass the URLs file path directly to the scraper
        await scrapeSaasHub({
            outputDir,
            allUrlsFilePath,    // Now passing the direct path to all_urls.json
            batchSize: 5000, // Controls both batch processing and records per file
            rateLimit: 30
        });
        
        console.log('Scraper completed successfully.');

        // After scraping is complete, consolidate results to CSV
        console.log('Starting JSON to CSV conversion...');
        await consolidateJsonToCsv(outputDir);
        console.log('CSV conversion completed successfully.');
    } catch (error) {
        console.error('Error running scraper:', error);
        process.exit(1);
    }
})();

