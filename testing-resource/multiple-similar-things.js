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
        let thing = wot.produce({name: 'MyParking'});

        thing['@context'] = [thing['@context'],
            {
                schema: "https://schema.org/",
                datex: "http://vocab.datex.org/terms#",
                m3lite: "http://purl.org/iot/vocab/m3-lite#"
            }
        ];
        thing['https://schema.org/address'] = 'Hamburg';
        thing['https://schema.org/category'] = 'urn:big-iot:ParkingSiteCategory';

        thing.addProperty('status', {
            writable: false,
            type: "string",
            const: false,
            label: 'Occupied/Available status',
            value: "available",
            '@type': ['datex:parkingSpaceStatus']
        }).addProperty('lightSensor', {
            writable: false,
            type: "number",
            const: false,
            label: 'Light intensity',
            value: getRandomInt(1000),
            '@type': ['m3lite:LightSensor']
        }).addProperty('position', {
            writable: false, type: "object", const: false, label: 'Longitude', value: {latitude: 53.3 + Math.random()/2, longitude: 9.7 + Math.random()/2},
            properties: {
                latitude: {type: "number", '@type': ['schema:latitude']},
                longitude: {type: "number", '@type': ['schema:longitude']},
            }
        }).addAction('doParkingReservation', {}).addAction('setParkingSpaceAvailable', {})
            .setActionHandler('doParkingReservation', (params) => {
                return new Promise((resolve, reject) => {
                    thing.properties['status'].set('occupied').then(() => {
                        resolve();
                    });
                });
            }).setActionHandler('setParkingSpaceAvailable', (params) => {
            return new Promise((resolve, reject) => {
                thing.properties['status'].set('available').then(() => {
                    resolve();
                });
            });
        });
        thing.expose();
    });
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}