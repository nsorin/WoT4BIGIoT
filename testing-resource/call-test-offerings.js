const http = require('http');

const BASE = 'http://localhost:65000/MyParking';
const READ_URI = '-Read';
const CALL_INTERVAL = 500;

let iterations = 1;

if (process.argv.length > 2) {
    let input = Number(process.argv[2]);
    iterations = input === 0 || isNaN(input) ? iterations : input;
}

setInterval(() => {
    // First one
    call(BASE + READ_URI);
// Other ones
    for (let i = 1; i < iterations; i++) {
        call(BASE + i + READ_URI);
    }
}, CALL_INTERVAL);

function call(url) {
    http.get(url, (res) => {
       // NOTHING TO DO HERE
    }).on('error', (err) => {
    	// NOTHING TO DO HERE
    });
}

