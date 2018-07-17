/**
 * Quantity test: set up a gateway to manage a high amount of things and check performance.
 **/

import fs = require('fs');
import path = require('path');
import http = require('http');
import coap = require('coap');
import {Api} from "../api";

const TEST_CONFIG_SOURCE = '../testing-resource/quantity-config.json';

fs.readFile(path.resolve(__dirname, '../../testing-resource/thing-list.txt'), (err, data) => {
    if (err) {
        console.log('Could not read thing list!', err);
        process.exit(1);
    }
    let thingUris = data.toString().split('\n').map((val) => {
        // Deal with windows line endings
        return val.replace('\r', '');
    });

    Api.getApi(TEST_CONFIG_SOURCE).then((api: Api) => {
        let promises = [];
        let c = 0;
        for (let i = 8000; i < 18000; i++) {
            c+= i;
        }
        for (let i = 0; i < thingUris.length; i++) {
            if (thingUris[i].startsWith('http')) {
                promises.push(new Promise((resolve, reject) => {
                    http.get(thingUris[i], (res) => {
                        res.setEncoding("utf8");
                        let body = "";
                        res.on("data", data => {
                            body += data;
                        }).on("end", () => {
                            let nbStr = body.substring(415, 420).replace('/', '');
                            c -= Number(nbStr);
                            console.log('Port was:', nbStr, 'and total is', c);
                            resolve(body);
                        });
                    }).on('error', function(e) {
                        console.log("Got error at", (8000 + c++), ": " + e.message);
                    });
                }));
            } else if (thingUris[i].startsWith('coap')) {
                promises.push(new Promise((resolve, reject) => {
                    let req = coap.request(thingUris[i]);
                    req.on('response', res => {
                        let payload = res.payload.toString();
                        resolve(payload);
                    });
                    req.end();
                }));
            } else {
                // Assume URI is local
                promises.push(new Promise((resolve, reject) => {
                    fs.readFile(thingUris[i], "utf-8", (err, data) => {
                        if (err) throw err;
                        resolve(data);
                    });
                }));
            }
        }
        // Call api with results
        Promise.all(promises).then((tds) => {
            console.log('Thing List Loaded');
            try {
                api.convertThings(tds);
                console.log('Conversion made');
            } catch (e) {
                console.log('Thing conversion error:', e);
            }
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => {
                console.log('Shutting down...');
            });
        }).catch((err) => {
            console.log(err);
        });
    });
});