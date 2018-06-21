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
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 10, '@type': ['schema:longitude']});
    thing.expose();
});

const srv2 = new node_wot.Servient();
srv2.addServer(new HttpServer(port2, IP));


srv2.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "http://schema.org/"}];

    thing.addProperty('latitude', {writable: false, type: "number", const: true, label: 'Latitude', value: 48, '@type': ['schema:latitude']})
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 10, '@type': ['schema:longitude']});
    thing.expose();
});

const srv3 = new node_wot.Servient();
srv3.addServer(new HttpServer(port3, IP));


srv3.start().then((wot) => {
    let thing = wot.produce({name: 'MySensor'});

    thing['@context'] = [thing['@context'], {schema: "http://schema.org/"}];

    thing.addProperty('latitude', {writable: false, type: "number", const: true, label: 'Latitude', value: 49, '@type': ['schema:latitude']})
        .addProperty('longitude', {writable: false, type: "number", const: true, label: 'Longitude', value: 10, '@type': ['schema:longitude']});
    thing.expose();
});