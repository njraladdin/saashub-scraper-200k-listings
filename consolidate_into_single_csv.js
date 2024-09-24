const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');
const { createGunzip } = require('zlib');
const { stringify } = require('csv-stringify');
const archiver = require('archiver');

const folderPath = path.join(__dirname, 'scraping_results');
const outputCsvPath = path.join(folderPath, 'all.csv');
const outputTwoColumnsCsvPath = path.join(folderPath, 'all_two_columns.csv');
const outputZipPath = path.join(folderPath, 'all.zip');

async function* readJsonFiles(directory) {
  const files = await fs.readdir(directory);
  const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'last_processed_info.json');
  
  for (const file of jsonFiles) {
    const filePath = path.join(directory, file);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    for (const item of jsonData) {
      yield item;
    }
  }
}

async function processData() {
  const csvStream = stringify({ header: true });
  const csvOutput = createWriteStream(outputCsvPath);
  csvStream.pipe(csvOutput);

  const twoColumnsCsvStream = stringify({ header: true });
  const twoColumnsCsvOutput = createWriteStream(outputTwoColumnsCsvPath);
  twoColumnsCsvStream.pipe(twoColumnsCsvOutput);

  let count = 0;
  for await (const item of readJsonFiles(folderPath)) {
    csvStream.write(item);
    twoColumnsCsvStream.write({
      saashub_url: item.url,
      Website: item.Website
    });

    count++;
    if (count % 1000 === 0) {
      console.log(`Processed ${count} items`);
    }
  }

  csvStream.end();
  twoColumnsCsvStream.end();

  console.log('CSV files have been saved');

  await new Promise((resolve) => {
    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`all.zip has been created, total bytes: ${archive.pointer()}`);
      resolve();
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.file(outputCsvPath, { name: 'all.csv' });
    archive.file(outputTwoColumnsCsvPath, { name: 'all_two_columns.csv' });
    archive.finalize();
  });
}

processData().catch(console.error);