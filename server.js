const express = require('express');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const run_scraper = require('./run_scraper');  // Import the main function from main.js

const app = express();
const server = http.createServer(app);

const LOG_FILE = path.join(__dirname, 'scraper.log');

function getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

function parseLogEntry(logEntry) {
    try {
        const parsed = JSON.parse(logEntry);
        return {
            timestamp: new Date(parsed.timestamp).toLocaleString(),
            level: parsed.level,
            message: parsed.message
        };
    } catch (error) {
        return {
            timestamp: 'Unknown',
            level: 'UNKNOWN',
            message: logEntry
        };
    }
}

function formatLogs(logs) {
    return logs.map(log => {
        const { timestamp, level, message } = parseLogEntry(log);
        return `<div class="log-entry ${level.toLowerCase()}">
            <span class="timestamp">${timestamp}</span>
            <span class="level">[${level.toUpperCase()}]</span>
            <span class="message">${message}</span>
        </div>`;
    }).join('');
}

app.get('/', async (req, res) => {
    try {
        const data = await fs.readFile(LOG_FILE, 'utf8');
        const logs = data.split('\n').filter(Boolean).reverse();
        const formattedLogs = formatLogs(logs);

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Scraper Logs</title>
            <style>
                body {
                    font-family: monospace;
                    margin: 0;
                    padding: 20px;
                    background-color: #f0f0f0;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 20px;
                }
                .log-container {
                    background-color: #fff;
                    border: 1px solid #ccc;
                    padding: 10px;
                    overflow-y: auto;
                    height: 80vh;
                }
                .log-entry {
                    margin-bottom: 5px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .timestamp {
                    color: #666;
                }
                .level {
                    font-weight: bold;
                    margin-right: 5px;
                }
                .error .level {
                    color: #d00;
                }
                .warn .level {
                    color: #f90;
                }
                .info .level {
                    color: #0a0;
                }
            </style>
        </head>
        <body>
            <h1>Scraper Logs</h1>
            <div class="log-container">
                ${formattedLogs}
            </div>
            <script>
                setTimeout(function(){ location.reload(); }, 60000);  // Refresh every 60 seconds
            </script>
        </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error reading log file:', error);
        res.status(500).send('Error reading logs: ' + error.message);
    }
});

const PORT = 8080;

server.listen(PORT, () => {
    const ipAddress = getIPAddress();
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the log viewer at:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://${ipAddress}:${PORT}`);
    
    // Start the scraper
    run_scraper().catch(console.error);
});