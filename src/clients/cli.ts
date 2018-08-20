import readline = require('readline');
import fs = require('fs');
import path = require('path');
import {Api} from '../api';
import {MetadataManager} from '../metadata-manager';
import {Thing, serializeTD} from "../../thingweb.node-wot/packages/td-tools";
import {GatewayRoute} from "../gateway-route";

const CONVERT_THINGS = 'convert_things';
const SHOW_OFFERINGS_TO_REGISTER = 'show_offerings_to_register';
const SHOW_REGISTERED_OFFERINGS = 'show_registered_offerings';
const REGISTER_ALL_OFFERINGS = 'register_all_offerings';
const DELETE_ALL_OFFERINGS = 'delete_all_offerings';
const REGISTER_OFFERINGS = 'register_offerings';
const DELETE_OFFERINGS = 'delete_offerings';
const CONVERT_OFFERINGS = 'convert_offerings';

const THING_SAVE_PATH = '../../output/';

/**
 * Class used for CLI commands.
 */
class Command {

    /**
     * Constructor.
     * @param _name Name of the command.
     * @param _args Description of the command's expected arguments.
     * @param _toExecute Function to execute when the command is used.
     */
    constructor(
        private _name: string,
        private _args: string,
        private _toExecute: any) {
    }

    get name() {
        return this._name;
    }

    get args() {
        return this._args;
    }

    /**
     * Call the function associated with the command.
     * @param api
     * @param {string} args
     * @return {any}
     */
    public call(api: Api, args: string) {
        return this._toExecute(api, args.split(' '));
    }

}

const COMMANDS = {
    [CONVERT_THINGS]: new Command(CONVERT_THINGS, '<td_uri>...', convertThings),
    [SHOW_OFFERINGS_TO_REGISTER]: new Command(SHOW_OFFERINGS_TO_REGISTER, '', showOfferingsToRegister),
    [SHOW_REGISTERED_OFFERINGS]: new Command(SHOW_REGISTERED_OFFERINGS, '', showRegisteredOfferings),
    [REGISTER_ALL_OFFERINGS]: new Command(REGISTER_ALL_OFFERINGS, '', registerAllOfferings),
    [DELETE_ALL_OFFERINGS]: new Command(DELETE_ALL_OFFERINGS, '', deleteAllOfferings),
    [REGISTER_OFFERINGS]: new Command(REGISTER_OFFERINGS, '<name>...', registerOfferings),
    [DELETE_OFFERINGS]: new Command(DELETE_OFFERINGS, '<name>...', deleteOfferings),
    [CONVERT_OFFERINGS]: new Command(CONVERT_OFFERINGS, '<offering_id>...', convertOfferings)
};

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

Api.getApi().then((api) => {
    console.log('WoT4BIGIoT Command Line Interface ------------------------------');
    console.log('Usage: ');
    for (let i in COMMANDS) {
        if (COMMANDS.hasOwnProperty(i)) {
            console.log(COMMANDS[i].name, COMMANDS[i].args);
        }
    }
    console.log('----------------------------------------------------------------');

    waitForCommand(api, rl);
});

/**
 * Wait for user input when a command is expected.
 * @param {Api} api
 * @param rl
 */
function waitForCommand(api: Api, rl: any) {
    rl.question('Enter a command here: \n', (answer) => {
        answer = answer.replace(/(\r\n\t|\n|\r\t)$/, '');

        let spaceIndex = answer.indexOf(' ');
        let command = answer;
        let args = '';
        if (spaceIndex > -1) {
            command = answer.substr(0, spaceIndex);
            args = answer.substr(spaceIndex + 1);
        }
        if (COMMANDS.hasOwnProperty(command)) {
            COMMANDS[command].call(api, args).then(() => {
                waitForCommand(api, rl);
            });
        } else {
            console.log('Unrecognized command:', command, 'Please try again.');
            waitForCommand(api, rl);
        }
    });
}

// --- CORE COMMANDS
/**
 * Convert Things based on their URI.
 * @param {Api} api
 * @param {Array<string>} uris
 * @return {Promise<any>}
 */
function convertThings(api: Api, uris: Array<string>): Promise<void> {
    return api.convertThingsFromUris(uris);
}

/**
 * Convert Offerings based on their ids.
 * @param {Api} api
 * @param {Array<string>} offeringIds
 * @return {Promise<any>}
 */
function convertOfferings(api: Api, offeringIds: Array<string>): Promise<any> {
    return api.convertOfferings(offeringIds).then((things) => {
        saveThings(things);
        console.log('Things saved!');
    });
}

/**
 * Register offerings already added when converting things, based on their names.
 * @param {Api} api
 * @param {Array<string>} names
 * @return {Promise<any>}
 */
function registerOfferings(api: Api, names: Array<string>) {
    return new Promise((resolve, reject) => {
        let list = api.getOfferingsToRegister();
        let finalList: Array<any> = [];
        for (let i = 0; i < list.length; i++) {
            if (names.indexOf(list[i].name) > -1) {
                finalList.push(list[i]);
            }
        }
        editOffering(api, rl, finalList, 0).then(() => {
            api.registerOfferings(names).then(() => {
                console.log('All offerings registered!');
                resolve();
            });
        });
    });
}

/**
 * Register all offerings already added when converting things.
 * @param {Api} api
 * @return {Promise<any>}
 */
function registerAllOfferings(api: Api) {
    return new Promise((resolve, reject) => {
        let list = api.getOfferingsToRegister();
        editOffering(api, rl, list, 0).then(() => {
            api.registerAllOfferings().then(() => {
                console.log('All offerings registered!');
                resolve();
            });
        });
    });
}

/**
 * Delete all registered offerings.
 * @param {Array<string>} offeringNames
 * @param {Api} api
 */
function deleteOfferings(api: Api, offeringNames: Array<string>): Promise<void> {
    return api.deleteOfferings(offeringNames);
}

/**
 * Delete all registered offerings.
 * @param {Api} api
 */
function deleteAllOfferings(api: Api) {
    api.deleteAllOfferings();
}

/**
 * Show the list of offerings waiting for registration on the marketplace.
 * @param {Api} api
 * @return {Promise<any>}
 */
function showOfferingsToRegister(api: Api): Promise<any> {
    return new Promise((resolve, reject) => {
        let list = api.getOfferingsToRegister();
        for (let i = 0; i < list.length; i++) {
            console.log(list[i].name);
        }
        resolve();
    });
}

/**
 * Show the list of offerings already registered on the marketplace.
 * @param {Api} api
 * @return {Promise<any>}
 */
function showRegisteredOfferings(api: Api): Promise<any> {
    return new Promise((resolve, reject) => {
        let list = api.getRegisteredOfferings();
        for (let i = 0; i < list.length; i++) {
            console.log(list[i].name);
        }
        resolve();
    });
}


// --- TOOLS

/**
 * Edit an offering which is waiting for registration. Allows user to input metadata.
 * @param {Api} api
 * @param rl
 * @param {Array<any>} offeringList
 * @param index
 * @return {Promise<any>}
 */
function editOffering(api: Api, rl: any, offeringList: Array<any>, index) {
    return new Promise((resolve, reject) => {
        if (index < offeringList.length) {
            askCategory(rl, offeringList[index], () => {
                askLicense(rl, offeringList[index], () => {
                    askSpatialExtent(rl, offeringList[index], () => {
                        askPrice(rl, offeringList[index], () => {
                            askSemanticType(api, rl, offeringList[index].inputData, 0, () => {
                                askSemanticType(api, rl, offeringList[index].outputData, 0, () => {
                                    editOffering(api, rl, offeringList, ++index).then(() => {
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } else {
            resolve();
        }
    });
}

/**
 * Ask user to enter a category for an offering.
 * @param rl
 * @param offering
 * @param callback
 */
function askCategory(rl: any, offering: any, callback: any) {
    rl.question('Category for ' + offering.name + '? (Suggested: ' + offering.rdfUri + ')',
        (answer) => {
            answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
            if (!answer) {
                callback();
            } else if ((answer)) {
                offering.rdfUri = MetadataManager.makeCategoryValid(answer);
                callback();
            }
        });
}

/**
 * Ask user to enter a license for an offering.
 * @param rl
 * @param offering
 * @param callback
 */
function askLicense(rl: any, offering: any, callback: any) {
    rl.question('License for ' + offering.name + '? (Suggested: ' + offering.license + ') '
        + MetadataManager.getFormattedArray(MetadataManager.LICENSES) + '\n', (answer) => {

        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
        if (!answer) {
            callback();
        } else if (MetadataManager.isLicenseValid(answer)) {
            offering.license = answer;
            callback();
        } else {
            console.log('Invalid input:', answer);
            askLicense(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter a spatial extent for an offering. Starts with the city.
 * @param rl
 * @param offering
 * @param callback
 */
function askSpatialExtent(rl: any, offering: any, callback: any) {
    rl.question('City for ' + offering.name + '? (Suggested: ' + offering.extent.city + ')\n', (answer) => {
        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
        // No invalid answer
        if (answer) {
            offering.extent.city = answer;
            // If there is a city, no need for a boundary
            delete offering.extent.boundary;
        }
        // If there is a city, no need for a boundary
        if (offering.extent.city) {
            callback();
        } else {
            // If no city, we need a boundary
            offering.extent.boundary = offering.extent.boundary ?
                offering.extent.boundary : {
                    l1: {
                        lat: MetadataManager.DEFAULT_BOUNDARY.l1.lat,
                        lng: MetadataManager.DEFAULT_BOUNDARY.l1.lng
                    },
                    l2: {
                        lat: MetadataManager.DEFAULT_BOUNDARY.l2.lat,
                        lng: MetadataManager.DEFAULT_BOUNDARY.l2.lng
                    }
                };
            askL1Latitude(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter a price for an offering. Starts with the pricing model.
 * @param rl
 * @param offering
 * @param callback
 */
function askPrice(rl: any, offering: any, callback: any) {
    rl.question('Pricing model for ' + offering.name + '? (Suggested: ' +
        offering.price.pricingModel + ') '
        + MetadataManager.getFormattedArray(MetadataManager.PRICING_MODELS) + '\n', (answer) => {

        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
        if (answer && MetadataManager.PRICING_MODELS.indexOf(answer) === -1) {
            console.log('Invalid input:', answer);
            askPrice(rl, offering, callback);
        } else {
            if (answer) {
                offering.price.pricingModel = answer;
            }
            if (offering.price.pricingModel === MetadataManager.FREE) {
                // If it is free, no further step is required
                delete offering.price.money;
                callback();
            } else {
                // Otherwise, an amount and a currency are needed
                offering.price.money =
                    offering.price.money ?
                        offering.price.money
                        : {
                            amount: MetadataManager.DEFAULT_AMOUNT,
                            currency: MetadataManager.DEFAULT_CURRENCY
                        };
                askCurrency(rl, offering, callback);
            }
        }
    });
}

/**
 * Ask user to enter a first latitude of a boundary.
 * @param rl
 * @param offering
 * @param callback
 */
function askL1Latitude(rl: any, offering: any, callback: any) {
    rl.question('Boundary for ' + offering.name + ': first corner latitude? (Suggested: '
        + offering.extent.boundary.l1.lat + ')\n', (answer) => {
        if (isNaN(answer)) {
            console.log('Invalid input:', answer);
            askL1Latitude(rl, offering, callback);
        } else if (answer === '') {
            askL1Longitude(rl, offering, callback);
        } else {
            offering.extent.boundary.l1.lat = Number(answer);
            askL1Longitude(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter a first longitude of a boundary.
 * @param rl
 * @param offering
 * @param callback
 */
function askL1Longitude(rl: any, offering: any, callback: any) {
    rl.question('Boundary for ' + offering.name + ': first corner longitude? (Suggested: '
        + offering.extent.boundary.l1.lng + ')\n', (answer) => {
        if (isNaN(answer)) {
            console.log('Invalid input:', answer);
            askL1Longitude(rl, offering, callback);
        } else if (answer === '') {
            askL2Latitude(rl, offering, callback);
        } else {
            offering.extent.boundary.l1.lng = Number(answer);
            askL2Latitude(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter a second latitude of a boundary.
 * @param rl
 * @param offering
 * @param callback
 */
function askL2Latitude(rl: any, offering: any, callback: any) {
    rl.question('Boundary for ' + offering.name + ': second corner latitude? (Suggested: '
        + offering.extent.boundary.l2.lat + ')\n', (answer) => {
        if (isNaN(answer)) {
            console.log('Invalid input:', answer);
            askL2Latitude(rl, offering, callback);
        } else if (answer === '') {
            askL2Longitude(rl, offering, callback);
        } else {
            offering.extent.boundary.l2.lat = Number(answer);
            askL2Longitude(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter a second longitude of a boundary.
 * @param rl
 * @param offering
 * @param callback
 */
function askL2Longitude(rl: any, offering: any, callback: any) {
    rl.question('Boundary for ' + offering.name + ': second corner longitude? (Suggested: '
        + offering.extent.boundary.l2.lng + ')\n', (answer) => {
        if (isNaN(answer)) {
            console.log('Invalid input:', answer);
            askL2Longitude(rl, offering, callback);
        } else if (answer === '') {
            callback();
        } else {
            offering.extent.boundary.l2.lng = Number(answer);
            callback();
        }
    });
}

/**
 * Ask user to enter the currency of a price.
 * @param rl
 * @param offering
 * @param callback
 */
function askCurrency(rl: any, offering: any, callback: any) {
    rl.question('Currency for ' + offering.name + '? (Suggested: '
        + offering.price.money.currency + ') ' + MetadataManager.getFormattedArray(MetadataManager.CURRENCIES) + '\n', (answer) => {
        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
        if (!answer) {
            askAmount(rl, offering, callback);
        } else if (MetadataManager.CURRENCIES.indexOf(answer) !== -1) {
            offering.price.money.currency = answer;
            askAmount(rl, offering, callback);
        } else {
            console.log('Invalid input:', answer);
            askCurrency(rl, offering, callback);
        }
    });
}

/**
 * Ask user to enter the amount of money of a price.
 * @param rl
 * @param offering
 * @param callback
 */
function askAmount(rl: any, offering: any, callback: any) {
    rl.question('Amount of money for ' + offering.name + '? (Suggested: '
        + offering.price.money.amount + ')\n', (answer) => {
        if (isNaN(answer) || Number(answer) < 0) {
            console.log('Invalid input:', answer);
            askAmount(rl, offering, callback);
        } else if (answer === '') {
            callback();
        } else {
            offering.price.money.amount = Number(answer);
            callback();
        }
    });
}

/**
 * Ask user to enter the semantic annotation for an input/output field, while showing suggestions found with the
 * SemanticSearcher.
 * @param {Api} api
 * @param rl
 * @param {Array<any>} fieldList
 * @param {number} index
 * @param callback
 */
function askSemanticType(api: Api, rl: any, fieldList: Array<any>, index: number, callback) {
    if (!fieldList || index >= fieldList.length) {
        // If no field left, use callback
        callback();
    } else if (Object.keys(MetadataManager.DATA_TYPE_CONVERSION).map(e => MetadataManager.DATA_TYPE_CONVERSION[e])
        .indexOf(fieldList[index].rdfUri) === -1) {
        // If this is not a default type, skip it
        askSemanticType(api, rl, fieldList, ++index, callback);
    } else {
        // Use semantic search to look for a fitting semantic type.
        api.getSemanticTypeSuggestions(fieldList[index].name.replace(GatewayRoute.MIN_PREFIX, '').replace(GatewayRoute.MAX_PREFIX, ''))
            .then((result) => {

                console.log("Suggested types for", fieldList[index].name + ":");
                for (let i = 0; i < result.length; i++) {
                    console.log(result[i].uri, "(" + result[i].description + ")");
                }
                rl.question("Semantic type for " + fieldList[index].name + "? (Default: " + fieldList[index].rdfUri + ")\n",
                    (answer) => {
                        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
                        if (answer) {
                            // TODO: Check validity?
                            fieldList[index].rdfUri = answer;
                        }
                        askSemanticType(api, rl, fieldList, ++index, callback);
                    });
            });
    }
}

/**
 * Save JSON TDs to files on the disk.
 * @param {Array<Thing>} things
 */
function saveThings(things: Array<Thing>) {
    for (let i = 0; i < things.length; i++) {
        fs.writeFileSync(path.resolve(__dirname, THING_SAVE_PATH + things[i].name + '.json'), serializeTD(things[i]));
    }
}

