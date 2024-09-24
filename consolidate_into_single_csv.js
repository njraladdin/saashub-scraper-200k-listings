const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const archiver = require('archiver');

const folderPath = path.join(__dirname, 'scraping_results');
const outputCsvPath = path.join(__dirname, 'scraping_results', 'all.csv');
const outputTwoColumnsCsvPath = path.join(__dirname, 'scraping_results', 'all_two_columns.csv');
const outputZipPath = path.join(__dirname, 'scraping_results', 'all.zip');

fs.readdir(folderPath, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'last_processed_info.json');
    let consolidatedData = [];

    jsonFiles.forEach(file => {
        const filePath = path.join(folderPath, file);
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        consolidatedData = consolidatedData.concat(fileData);
    });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(consolidatedData);

    fs.writeFileSync(outputCsvPath, csv, 'utf8');
    console.log('CSV file has been saved as all.csv');

    // Create all_two_columns.csv with only "saashub_url" and "Website" columns
    const twoColumnsData = consolidatedData.map(item => ({
        saashub_url: item.url,
        Website: item.Website
    }));

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
