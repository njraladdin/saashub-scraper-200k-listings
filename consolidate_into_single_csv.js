const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const archiver = require('archiver');

const folderPath = path.join(__dirname, 'scraping_results');
const outputCsvPath = path.join(__dirname, 'scraping_results', 'all.csv');
const outputTwoColumnsCsvPath = path.join(__dirname, 'scraping_results', 'all_two_columns.csv');
const outputZipPath = path.join(__dirname, 'scraping_results', 'all.zip');
const BATCH_SIZE = 10; // Number of files to process at a time

fs.readdir(folderPath, async (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'last_processed_info.json');
    let consolidatedData = [];
    let twoColumnsData = [];

    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batchFiles = jsonFiles.slice(i, i + BATCH_SIZE);
        let batchData = [];
        let batchTwoColumnsData = [];

        batchFiles.forEach(file => {
            const filePath = path.join(folderPath, file);
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            batchData = batchData.concat(fileData);
            batchTwoColumnsData = batchTwoColumnsData.concat(fileData.map(item => ({
                saashub_url: item.url,
                Website: item.Website
            })));
        });

        consolidatedData = consolidatedData.concat(batchData);
        twoColumnsData = twoColumnsData.concat(batchTwoColumnsData);
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(consolidatedData);

    fs.writeFileSync(outputCsvPath, csv, 'utf8');
    console.log('CSV file has been saved as all.csv');

    const json2csvTwoColumnsParser = new Parser({ fields: ['saashub_url', 'Website'] });
    const csvTwoColumns = json2csvTwoColumnsParser.parse(twoColumnsData);

    fs.writeFileSync(outputTwoColumnsCsvPath, csvTwoColumns, 'utf8');
    console.log('CSV file has been saved as all_two_columns.csv');

    // Zip the CSV files
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    output.on('close', () => {
        console.log(`all.zip has been created, total bytes: ${archive.pointer()}`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);
    archive.file(outputCsvPath, { name: 'all.csv' });
    archive.file(outputTwoColumnsCsvPath, { name: 'all_two_columns.csv' });
    archive.finalize();
});
