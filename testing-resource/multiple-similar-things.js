/**
 * Script used for testing purposes. Takes a number n as parameter, which corresponds to the amount of identical things
 * to expose.
 */

const node_wot = require('../thingweb.node-wot/packages/core');

const HttpServer = require('../thingweb.node-wot/packages/binding-http').default;

const IP = '127.0.0.1';
const startingPort = 8000;

let iterations = 1;

if (process.argv.length > 2) {
    let input = Number(process.argv[2]);
    iterations = input === 0 || isNaN(input) ? iterations : input;
}

for (let i = 0; i < iterations; i++) {
    const srv = new node_wot.Servient();
    srv.addServer(new HttpServer(startingPort + i, IP));

    srv.start().then((wot) => {
        let thing = wot.produce({name: 'MySensor'});

        thing['@context'] = [thing['@context'], {schema: "https://schema.org/"}];

        thing.addProperty('status', {
            writable: false,
            type: "string",
            const: false,
            label: 'ON/OFF Status',
            value: "OFF"
        }).addProperty('position', {
            writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 25, longitude: 5},
            properties: {
                latitude: {type: "number", '@type': ['schema:latitude']},
                longitude: {type: "number", '@type': ['schema:longitude']},
            }
        }).addAction('toggle', {input: {type: "boolean"}, output: {type: "string"}})
            .setActionHandler('toggle', (params) => {
                return new Promise((resolve, reject) => {
                    let status = params === 'true' || Number(params) === 1 ? 'ON' : 'OFF';
                    thing.properties['status'].set(status).then(() => {
                        resolve(status);
                    });
                });
            });
        thing.expose();
    });
}