/**
 * Example code to use the API to register Things on the marketplace and consume them as offerings.
 *
 * For this example to work, run  "node testing-resource/multiple-similar-things.js 5" from the root of the project. This
 * will produce 5 identical Things that can then be used for the example. The TDs must have localhost as base uri, not the
 * local IP (which is present when using the current version of node-wot, because it is not yet possible to force the use
 * of localhost). This means edits must be made to node-wot's dist files. Alternatively, the things can be run on another
 * machine on the local network and the local IP of the machine can be used.
 * **/
import {Api} from "../api";
import {MetadataManager} from "../metadata-manager";

// Config file should be created at this location
const CONFIG_SOURCE = '../testing-resource/convert-thing-ex-config.json';

// List of URIs to get TDs from. Follow instructions above to produce the Things.
const THING_URIS = [
    'http://localhost:8000/MyParking',
    'http://localhost:8001/MyParking',
    'http://localhost:8002/MyParking',
    'http://localhost:8003/MyParking',
    'http://localhost:8004/MyParking'
];

Api.getApi(CONFIG_SOURCE).then((api: Api) => {
    // Convert the Things to offerings using the URIs of the TDs. A convertThings function is also available if the TDs
    // have already been retrieved.
    api.convertThingsFromUris(THING_URIS).then(() => {
        // At this point, no offering has been registered. Pending offerings can be retrieved like this:
        let offerings = api.getOfferingsToRegister();
        // We can add metadata to the offerings. When using the CLI, this is done by prompting the user to enter values at
        // registration. For the purpose of this example, the same metadata is added to all the offerings. The format used is
        // defined in the bigiot-js library.
        for (let i = 0; i < offerings.length; i++) {
            console.log('Offering #' + i + ':', offerings[i].name);
            // Spatial extent can be an address, a boundary or both
            offerings[i].spatialExtent = {
                city: 'Hamburg'
            };
            offerings[i].license = MetadataManager.LICENSES[1]; // CREATIVE_COMMONS
            offerings[i].price = {
                pricingModel: MetadataManager.PRICING_MODELS[3], // PER_MONTH
                money: {
                    amount: 10,
                    currency: MetadataManager.CURRENCIES[0] // EUR
                }
            };
            offerings[i].rdfUri = 'urn:big-iot:ParkingCategory';
        }
        // Offerings are now ready to be registered. Registering all of them at once
        api.registerAllOfferings().then(() => {
            console.log('All offerings registered!');
            // We can now use bigiot-js to get the registered offerings on the marketplace
            // The API already created a consumer, we can reuse it
            api.getConsumer().subscribe(api.getProviderId() + '-MyParking_Read').then((subscription) => {
                api.getConsumer().access(subscription, {}).then((result) => {
                    console.log('Got results:');
                    console.log(result);
                }).catch((err) => {
                    console.log('Access error:');
                    console.log(err);
                });
            }).catch((err) => {
                console.log('Subscription error:');
                console.log(err);
            });
        }).catch((err) => {
            console.log('Failed to register offerings:');
            console.log(err);
        });
    });
}).catch((err) => {
    console.log('API init error:');
    console.log(err);
});
