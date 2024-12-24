const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');
const { createGunzip } = require('zlib');
const { stringify } = require('csv-stringify');
const archiver = require('archiver');

async function* readJsonFiles(directory) {
  const files = await fs.readdir(directory);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  for (const file of jsonFiles) {
    const filePath = path.join(directory, file);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    for (const item of jsonData) {
      yield item;
    }
  }
}

async function consolidateJsonToCsv(inputDirectory) {
  const outputCsvPath = path.join(inputDirectory, 'all.csv');
  const outputZipPath = path.join(inputDirectory, 'all.zip');

  console.log(`\nStarting consolidation process...`);
  console.log(`Input directory: ${inputDirectory}`);
  console.log(`CSV will be saved to: ${outputCsvPath}`);
  console.log(`ZIP will be saved to: ${outputZipPath}\n`);

  const csvStream = stringify({ header: true });
  const csvOutput = createWriteStream(outputCsvPath);
  csvStream.pipe(csvOutput);

  let count = 0;
  for await (const item of readJsonFiles(inputDirectory)) {
    csvStream.write(item);

    count++;
    if (count % 1000 === 0) {
      console.log(`Processed ${count} items`);
    }
  }

  csvStream.end();

  console.log(`\nCSV file has been saved to: ${outputCsvPath}`);

  await new Promise((resolve) => {
    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`ZIP archive has been created at: ${outputZipPath}`);
      console.log(`Total ZIP size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.file(outputCsvPath, { name: 'all.csv' });
    archive.finalize();
  });

  return {
    csvPath: outputCsvPath,
    zipPath: outputZipPath
  };
}

// Export the function
module.exports = {
  consolidateJsonToCsv
};

// Only run if called directly
if (require.main === module) {
  const scrapingResultsPath = path.join(__dirname, 'scraping_results');
  consolidateJsonToCsv(scrapingResultsPath).catch(console.error);
}