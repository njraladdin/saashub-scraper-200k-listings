const fs = require('fs');
const path = require('path');

const archiver = require('archiver');


const postRunChecks = () => {
  const scrapingResultsDir = path.join(__dirname, 'scraping_results');
  const sitemapFile = path.join(__dirname, 'sitemap_urls', 'all_urls.json');
  const errorLogFile = path.join(__dirname, 'error_log.json');
  const rerunUrlsFile = path.join(__dirname, 'sitemap_urls', 'rerun_urls.json');

  // Read and parse the sitemap file
  const sitemapUrls = JSON.parse(fs.readFileSync(sitemapFile, 'utf8'));

  // Get the list of URLs from the sitemap
  const allUrls = sitemapUrls.map(url => url.trim());

  // Read and parse all JSON files in the scraping_results directory, ignoring last_processed_info.json
  const scrapingFiles = fs.readdirSync(scrapingResultsDir).filter(file => file.endsWith('.json') && file !== 'last_processed_info.json');
  const scrapedUrls = new Set();

  scrapingFiles.forEach(file => {
    const filePath = path.join(scrapingResultsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data)) {
      data.forEach(entry => {
        if (entry.url) {
          scrapedUrls.add(entry.url.trim());
        }
      });
    } else {
      console.error(`File ${filePath} does not contain an array.`);
        console.error(`Content: ${JSON.stringify(data)}`);
    }
  });

  // Calculate the count and percentage of URLs that were downloaded and missing
  const downloadedCount = allUrls.filter(url => scrapedUrls.has(url)).length;
  const totalUrls = allUrls.length;
  const missingCount = totalUrls - downloadedCount;
  const downloadedPercentage = (downloadedCount / totalUrls) * 100;
  const missingPercentage = 100 - downloadedPercentage;

  console.log(`Downloaded URLs: ${downloadedCount} (${downloadedPercentage.toFixed(2)}%)`);
  console.log(`Missing URLs: ${missingCount} (${missingPercentage.toFixed(2)}%)`);

  // Read and parse the error log file
  const errorLog = JSON.parse(fs.readFileSync(errorLogFile, 'utf8'));

  // Initialize counters for different error types
  let error404Count = 0;
  let sanityCheckFailedCount = 0;
  let error403Count = 0;
  let urls403 = [];

  // Count the occurrences of each error type and collect 403 error URLs
  errorLog.forEach(entry => {
    if (entry.error.includes('HTTP error! status: 404')) {
      error404Count++;
    } else if (entry.error.includes('Sanity check failed')) {
      sanityCheckFailedCount++;
    } else if (entry.error.includes('HTTP error! status: 403')) {
      error403Count++;
      urls403.push(entry.url);
    }
  });

  // Log the counts of each error type
  console.log()
  console.log('ERRORS : ')
  console.log(`404 Errors: ${error404Count}`);
  console.log(`Sanity Check Failed Errors: ${sanityCheckFailedCount}`);
  console.log(`403 Errors: ${error403Count}`);

  // Find URLs that exist in all_urls but not in any of the scraping results
  const missingUrls = allUrls.filter(url => !scrapedUrls.has(url));

  // Combine 403 error URLs and missing URLs, excluding 404 errors
  const rerunUrls = [...new Set([...urls403, ...missingUrls.filter(url => 
    !errorLog.some(entry => entry.url === url && entry.error.includes('HTTP error! status: 404'))
  )])];

  // Save rerun URLs to rerun_urls.json
  fs.writeFileSync(rerunUrlsFile, JSON.stringify(rerunUrls, null, 2));
  console.log(`Saved ${rerunUrls.length} URLs to rerun (${urls403.length} with 403 errors and ${rerunUrls.length - urls403.length} missing, excluding 404 errors) to ${rerunUrlsFile}`);
}



function zipJsonFiles() {
  const scrapingResultsDir = path.join(__dirname, 'scraping_results');
  const outputZip = path.join(scrapingResultsDir, 'json_result.zip');

  const output = fs.createWriteStream(outputZip);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(`${archive.pointer()} total bytes`);
    console.log('Archiver has been finalized and the output file descriptor has closed.');
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // Read all files in the directory
  fs.readdirSync(scrapingResultsDir).forEach(file => {
    if (path.extname(file).toLowerCase() === '.json') {
      const filePath = path.join(scrapingResultsDir, file);
      archive.file(filePath, { name: file });
    }
  });

  archive.finalize();
}

zipJsonFiles();
