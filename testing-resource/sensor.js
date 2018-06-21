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

    thing['@context'] = [thing['@context'], {schema: "http://schema.org/"}];

    thing.addProperty('latitude', {writable: false, type: "number", const: true, label: 'Latitude', value: 50, '@type': ['schema:latitude']})
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 10, '@type': ['schema:longitude']})
        .addProperty('position', {writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 25, longitude: 5},
            properties: {
                latitude: {type: "number", '@type': ['schema:latitude']},
                longitude: {type: "number", '@type': ['schema:longitude']},
            }
        });
    thing.expose();
});

const srv2 = new node_wot.Servient();
srv2.addServer(new HttpServer(port2, IP));


srv2.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "http://schema.org/"}];

    thing.addProperty('latitude', {writable: false, type: "number", const: true, label: 'Latitude', value: 40, '@type': ['schema:latitude']})
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 20, '@type': ['schema:longitude']})
        .addProperty('position', {writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 20, longitude: 10},
            properties: {
                latitude: {type: "number", '@type': ['schema:latitude']},
                longitude: {type: "number", '@type': ['schema:longitude']},
            }
        });
    thing.expose();
});

const srv3 = new node_wot.Servient();
srv3.addServer(new HttpServer(port3, IP));


srv3.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "http://schema.org/"}];

    thing.addProperty('latitude', {writable: false, type: "number", const: true, label: 'Latitude', value: 20, '@type': ['schema:latitude']})
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 40, '@type': ['schema:longitude']})
        .addProperty('position', {writable: true, type: "object", const: false, label: 'Longitude', value: {latitude: 10, longitude: 5},
            properties: {
                latitude: {type: "number", '@type': ['schema:latitude']},
                longitude: {type: "number", '@type': ['schema:longitude']},
            }
        });
    thing.expose();
});