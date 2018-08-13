/**
 * Example code to use the API to consume an offering as a Thing.
 *
 * First, the WoT4BIGIoT API is used to generate a valid Thing Description from the offerings, which are directly taken
 * from the marketplace.
 * Then, the generated TD is consumed using the Web of Thing's node-wot library. This is done the same way as for any
 * WoT Thing, without the library "knowing" that the Thing comes from the marketplace.
 * From there, the output of the interactions could be used in any standard WoT application.
 * **/


import {Api} from "../api";
import {Thing, serializeTD} from "../../thingweb.node-wot/packages/td-tools";
import {Servient} from "../../thingweb.node-wot/packages/core";
import {HttpsClientFactory} from "../../thingweb.node-wot/packages/binding-http";

// Config file should be created at this location
const CONFIG_SOURCE = '../testing-resource/convert-offering-ex-config.json';

// List of offering ids to convert to a Thing. Update if the listed offerings are no longer available on the marketplace.
const OFFERINGS_TO_CONVERT = [
    'Bosch_CR-AirQualityDataService-AirQualityData_Offering',
    'Bosch_CR-AirQualityDataService-WeatherData_Offering'
];


// Init the API with the desired config file. Config file must already exist and be valid!
Api.getApi(CONFIG_SOURCE).then((api: Api) => {
    // Get one or more Things from the offerings
    api.convertOfferings(OFFERINGS_TO_CONVERT).then((things: Array<Thing>) => {
        // Take first thing. In PROVIDER_TO_THING conversion strategy (recommanded one) only one Thing will be created anyway.
        let thing = things[0];
        let td = serializeTD(thing);

        // Init WoT  Servient to consume the converted Thing with no knowledge of the original offering
        const srv = new Servient();

        // Add client
        srv.addClientFactory(new HttpsClientFactory({allowSelfSigned: true}));

        // Start servient
        srv.start().then((wot) => {
            let consumedThing = wot.consume(td);
            // Read generated properties
            for (let property in consumedThing.properties) {
                if (consumedThing.properties.hasOwnProperty(property)) {
                    consumedThing.properties[property].read().then((result) => {
                        console.log('Successfully invoked property', property);
                        // DO SOMETHING WITH RESULT
                        // console.log(result);
                    }).catch((error) => {
                        console.log('Error when invoking property', property);
                        console.log(error);
                    });
                }
            }
            // Invoke generated actions
            for (let action in consumedThing.actions) {
                if (consumedThing.actions.hasOwnProperty(action)) {
                    consumedThing.actions[action].invoke().then((result) => {
                        console.log('Successfully invoked action', action);
                        // DO SOMETHING WITH RESULT
                        // console.log(result);
                    }).catch((error) => {
                        console.log('Error when invoking action', action);
                        console.log(error);
                    });
                }
            }
        });

    }).catch((err) => {
        console.log('Failed to convert offerings:', err);
    })
}).catch((err) => {
    console.log(err);
});

