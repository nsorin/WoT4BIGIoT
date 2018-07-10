const bigiot = require('./bigiot-js');

let provider = new bigiot.provider('NSTest-NSProvider', 'C2ZEvzPbRg-iJAYhVAyLAQ==', 'https://market-dev.big-iot.org/');

provider.authenticate().then(() => {
    let offering = new bigiot.offering('TestOffering', 'urn:big-iot:allOfferingsCategory');
    offering.endpoints.push({
       uri: 'http://localhost:8080/TestOffering',
       accessInterfaceType: 'EXTERNAL',
       endpointType: 'HTTP_POST'
    });
    offering.spatialExtent = {city: 'Hamburg'};
    offering.inputData.push({

    });
});