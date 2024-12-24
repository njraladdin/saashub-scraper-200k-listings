# saashub-scraper-200k-listings

A Node.js-based web scraper for 200k saashub.com product listings.

<img src="images/logs.png" alt="Scraper Logs" width="600"/>

## Features

- Processes XML sitemaps and extracts product URLs
- Batched scraping with rate limiting
- Proxy support and error handling
- Outputs both JSON and CSV files with:
  - Basic info (name, description, website, rating)
  - Social links
  - Pricing and platform details
  - Media content
  - Reviews and Q&A

## Prerequisites

- Node.js (version 14 or higher recommended)
- npm (usually comes with Node.js)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/saashub-scraper-200k-listings.git
   cd saashub-scraper-200k-listings
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the proxy configuration:
   - Create a `.env` file in the project root
   - Add the following proxy configuration (replace with your actual proxy details):
     ```
     PROXY_HOST=your_proxy_host
     PROXY_PORT=your_proxy_port
     PROXY_USER=your_username
     PROXY_PASS=your_password
     ```

## Usage

Run the main script to start the scraping process:
```
node main.js
```

The script will:
1. Download and process sitemaps
2. Extract and deduplicate URLs
3. Scrape SaaS product data in batches
4. Save results in both JSON and CSV formats
5. Consolidate results into final CSV files

## Configuration

The scraper can be configured through parameters passed to the `scrapeSaasHub` function in `main.js`:

```javascript
await scrapeSaasHub({
    outputDir,           // Directory for output files
    allUrlsFilePath,    // Path to processed URLs file
    batchSize: 5000,    // Number of URLs to process in each batch
    rateLimit: 30,      // Maximum requests per second
    maxUrls: 0         // Optional: limit total URLs to process (0 = no limit)
});
```

## Output Structure

The scraper organizes output files in the following structure:

```
results/
├── json/
│   ├── saas_data_0.json
│   ├── saas_data_1.json
│   └── ...
├── csv/
│   ├── saas_data_0.csv
│   ├── saas_data_1.csv
│   └── ...
└── error_log.json
```

## Data Fields

The scraper extracts comprehensive information for each SaaS product, including:

- Basic Information (name, description, website, rating)
- Social Media Links (LinkedIn, Twitter, Facebook, etc.)
- Platform Information
- Pricing Details
- Media Content (screenshots, videos)
- External Reviews
- Q&A Content
- Categories and Tags
- And more...

## Error Handling

The scraper includes robust error handling:

- Automatic retries for failed requests
- Detailed error logging in `error_log.json`
- Sanity checks for data quality
- Progress tracking with time estimates
- Graceful handling of rate limits and timeouts

## Example Data

🔍 Check out real examples of scraped SaaS listings here:

[**View Sample Data**](https://api.npoint.io/8c43e9e9678a1271b5ec)

## Contributing

If you'd like to contribute to this project, please fork the repository and submit a pull request.

## Disclaimer

This project is for educational purposes only. Please use responsibly