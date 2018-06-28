import readline = require('readline');
import fs = require('fs');
import http = require('http');
import coap = require('coap');
import {Api} from '../api';
import {MetadataManager} from '../metadata-manager';

const CONVERT_THINGS = 'convert_things';
const SHOW_OFFERINGS_TO_REGISTER = 'show_offerings_to_register';
const SHOW_REGISTERED_OFFERINGS = 'show_registered_offerings';
const REGISTER_ALL_OFFERINGS = 'register_all_offerings';
const DELETE_ALL_OFFERINGS = 'delete_all_offerings';
const REGISTER_OFFERINGS = 'register_offerings';

const CONVERT_OFFERINGS = 'convert_offerings';

class Command {
    private readonly name: string;
    private readonly args: string;
    private readonly toExecute: any;

    constructor(name, args, toExecute) {
        this.name = name;
        this.args = args;
        this.toExecute = toExecute;
    }

    public getName() {
        return this.name;
    }

    public getArgs() {
        return this.args;
    }

    public call(api, args: string) {
        return this.toExecute(api, args.split(' '));
    }

}

const COMMANDS = {
    [CONVERT_THINGS]: new Command(CONVERT_THINGS, '<td_uri>...', convertThings),
    [SHOW_OFFERINGS_TO_REGISTER]: new Command(SHOW_OFFERINGS_TO_REGISTER, '', showOfferingsToRegister),
    [SHOW_REGISTERED_OFFERINGS]: new Command(SHOW_REGISTERED_OFFERINGS, '', showRegisteredOfferings),
    [REGISTER_ALL_OFFERINGS]: new Command(REGISTER_ALL_OFFERINGS, '', registerAllOfferings),
    [DELETE_ALL_OFFERINGS]: new Command(DELETE_ALL_OFFERINGS, '', deleteAllOfferings),
    [REGISTER_OFFERINGS]: new Command(REGISTER_OFFERINGS, '<uri>...', registerOfferings),
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
            console.log(COMMANDS[i].getName(), COMMANDS[i].getArgs());
        }
    }
    console.log('----------------------------------------------------------------');

    waitForCommand(api, rl);
});

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
function convertThings(api: Api, uri: Array<string>): Promise<any> {
    return new Promise((resolve, reject) => {
        let promises = [];
        for (let i = 0; i < uri.length; i++) {
            console.log('Getting thing at ' + uri[i]);
            if (uri[i].startsWith('http')) {
                promises.push(new Promise((resolve, reject) => {
                    http.get(uri[i], (res) => {
                        res.setEncoding("utf8");
                        let body = "";
                        res.on("data", data => {
                            body += data;
                        }).on("end", () => {
                            resolve(body);
                        });
                    });
                }));
            } else if (uri[i].startsWith('coap')) {
                promises.push(new Promise((resolve, reject) => {
                    let req = coap.request(uri[i]);
                    req.on('response', res => {
                        let payload = res.payload.toString();
                        resolve(payload);
                    });
                    req.end();
                }));
            } else {
                // Assume URI is local
                promises.push(new Promise((resolve, reject) => {
                    fs.readFile(uri[i], "utf-8", (err, data) => {
                        if (err) throw err;
                        resolve(data);
                    });
                }));
            }
        }
        // Call api with results
        Promise.all(promises).then((tds) => {
            api.convertThings(tds);
            resolve();
        });
    });
}

function convertOfferings(api: Api, offeringIds: Array<string>): Promise<any> {
    return api.convertOfferings(offeringIds);
}

function registerOfferings(api: Api, uris: Array<string>) {
    return new Promise((resolve, reject) => {
        resolve();
    });
}

function registerAllOfferings(api: Api) {
    return new Promise((resolve, reject) => {
        let list = api.getOfferingsToRegister();
        editOffering(rl, list, 0).then(() => {
            api.registerAllOfferings().then(() => {
                console.log('All offerings registered!');
                resolve();
            });
        });
    });
}

function deleteAllOfferings(api: Api) {
    api.deleteAllOfferings();
}

function showOfferingsToRegister(api: Api): Promise<any> {
    return new Promise((resolve, reject) => {
        let list = api.getOfferingsToRegister();
        for (let i = 0; i < list.length; i++) {
            console.log(list[i].name);
        }
        resolve();
    });
}

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

function editOffering(rl: any, offeringList: Array<any>, index) {
    return new Promise((resolve, reject) => {
        if (index < offeringList.length) {
            askCategory(rl, offeringList[index], () => {
                askLicense(rl, offeringList[index], () => {
                    askSpatialExtent(rl, offeringList[index], () => {
                        askPrice(rl, offeringList[index], () => {
                             editOffering(rl, offeringList, ++index).then(() => {
                                 resolve();
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
            this.askLicense(offering, callback);
        }
    });
}

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
                offering.extent.boundary : MetadataManager.DEFAULT_BOUNDARY;
            askL1Latitude(rl, offering, callback);
        }
    });
}

function askPrice(rl: any, offering: any, callback: any) {
    rl.question('Pricing model for ' + offering.name + '? (Suggested: ' +
        offering.price.pricingModel + ') '
        + MetadataManager.getFormattedArray(MetadataManager.PRICING_MODELS) + '\n', (answer) => {

        answer = answer.replace(/(\r\n\t|\n|\r\t)/, '');
        if (answer && MetadataManager.PRICING_MODELS.indexOf(answer) === -1) {
            console.log('Invalid input:', answer);
            this.askPrice(rl, offering, callback);
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
                        : MetadataManager.DEFAULT_MONEY;
                askCurrency(rl, offering, callback);
            }
        }
    });
}

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

function askAmount(rl: any, offering: any, callback: any) {
    rl.question('Amount of money for ' + offering.name + '? (Suggested: '
        + offering.price.money.amount + ')\n', (answer) => {
        if (isNaN(answer)) {
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
