const node_wot = require('../thingweb.node-wot/packages/core');

const HttpServer = require('../thingweb.node-wot/packages/binding-http').default;

const IP = '127.0.0.1';
const port1 = 8080;
const port2 = 8082;
const port3 = 8084;

const srv = new node_wot.Servient();
srv.addServer(new HttpServer(port1, IP));


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
    thing['https://schema.org/latitude'] = 25;
    thing['https://schema.org/longitude'] = 5;
    thing['https://schema.org/priceSpecification'] = {
        'http://schema.big-iot.org/core/pricingModel': 'PER_ACCESS',
        money: {
            'https://schema.org/currency': 'EUR',
            'https://schema.org/amount': 1
        }
    };
    thing.expose();
});

const srv2 = new node_wot.Servient();
srv2.addServer(new HttpServer(port2, IP));


srv2.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "https://schema.org/"}];

    thing.addProperty('status', {
        writable: false,
        type: "string",
        const: false,
        label: 'ON/OFF Status',
        value: "OFF"
    }).addProperty('position', {
        writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 20, longitude: 10},
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
    thing['schema:latitude'] = 20;
    thing['schema:longitude'] = 10;
    thing['https://schema.org/priceSpecification'] = {
        'http://schema.big-iot.org/core/pricingModel': 'PER_ACCESS',
        money: {
            'https://schema.org/currency': 'EUR',
            'https://schema.org/amount': 2
        }
    };
    thing.expose();
});

const srv3 = new node_wot.Servient();
srv3.addServer(new HttpServer(port3, IP));


srv3.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "https://schema.org/"}];

    thing.addProperty('status', {
        writable: false,
        type: "string",
        const: false,
        label: 'ON/OFF Status',
        value: "OFF"
    }).addProperty('position', {
        writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 10, longitude: 5},
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
    thing['https://schema.org/latitude'] = 10;
    thing['https://schema.org/longitude'] = 5;
    thing.properties['status']['https://schema.org/priceSpecification'] = {
        'http://schema.big-iot.org/core/pricingModel': 'PER_ACCESS',
        money: {
            'https://schema.org/currency': 'EUR',
            'https://schema.org/amount': 4
        }
    };
    thing.properties['position']['https://schema.org/priceSpecification'] = {
        'http://schema.big-iot.org/core/pricingModel': 'PER_ACCESS',
        money: {
            'https://schema.org/currency': 'EUR',
            'https://schema.org/amount': 2
        }
    };
    thing.expose();
});