/**
 * Quality test: convert a list of offering from the marketplace to a thing, then convert the thing back to offerings
 * and register them. Then compare each original offering with its twice converted counterpart. Metadata and in/output
 * should match.
 **/
import {Api} from "../api";
import fs = require('fs');
import path = require('path');
import {Thing, serializeTD} from "../../thingweb.node-wot/packages/td-tools";

const TEST_CONFIG_SOURCE = '../testing-resource/quality-config.json';

class QualityTestErrors {
    private _amountTested: number = 0;
    private _notRegistered: number = 0;
    private _endpoint: number = 0;
    private _input: number = 0;
    private _output: number = 0;
    private _spatialExtent: number = 0;
    private _license: number = 0;
    private _price: number = 0;
    private _category: number = 0;
    private _different: number = 0;

    constructor() {
        // Nothing to do here
    }

    public totalErrors() {
        return this.notRegistered + this.endpoint + this.input + this.output + this.spatialExtent
            + this.license + this.price + this.category;
    }

    get amountTested(): number {
        return this._amountTested;
    }

    get notRegistered(): number {
        return this._notRegistered;
    }

    get endpoint(): number {
        return this._endpoint;
    }

    get input(): number {
        return this._input;
    }

    get output(): number {
        return this._output;
    }

    get spatialExtent(): number {
        return this._spatialExtent;
    }

    get license(): number {
        return this._license;
    }

    get price(): number {
        return this._price;
    }

    get category(): number {
        return this._category;
    }

    get different(): number {
        return this._different;
    }

    public incrementAmountTested() {
        this._amountTested++;
    }

    public incrementNotRegistered() {
        this._notRegistered++;
    }

    public incrementEndpoint() {
        this._endpoint++;
    }

    public incrementInput() {
        this._input++;
    }

    public incrementOutput() {
        this._output++;
    }

    public incrementSpatialExtent() {
        this._spatialExtent++;
    }

    public incrementLicense() {
        this._license++;
    }

    public incrementPrice() {
        this._price++;
    }

    public incrementCategory() {
        this._category++;
    }

    public incrementDifferent() {
        this._different++;
    }
}


fs.readFile(path.resolve(__dirname, '../../testing-resource/offering-list.txt'), (err, data) => {
    if (err) {
        console.log('Could not read offering list!', err);
        process.exit(1);
    }
    let offeringIds = data.toString().split('\n').map((val) => {
        // Deal with windows line endings
        return val.replace('\r', '');
    });
    Api.getApi(TEST_CONFIG_SOURCE).then((api: Api) => {
        api.convertOfferings(offeringIds).then((things: Array<Thing>) => {
            // Serialize things before sending them back as params of the API
            let stringArray: Array<string> = [];
            for (let i = 0; i < things.length; i++) {
                stringArray.push(serializeTD(things[i]));
            }
            // Convert them back
            api.convertThings(stringArray);
            // Register
            api.registerAllOfferings().then(() => {
                // Get list of the newly registered offering ids using the marketplace's reformatting strategy
                let newIds = offeringIds.map((val) => {
                    return api.getProviderId() + '-' + val.replace('-', '_').replace('-', '_');
                });
                getAndCompare(api.getConsumer(), offeringIds, newIds, new QualityTestErrors(), 0).then((errors: QualityTestErrors) => {
                    console.log('--------------------------------------------------------------------');
                    console.log('QUALITY TEST COMPLETE! Tested', errors.amountTested, 'offerings.');
                    console.log('--------------------------------------------------------------------');
                    console.log('Endpoint errors:', errors.endpoint);
                    console.log('Input errors:', errors.input);
                    console.log('Output errors:', errors.output);
                    console.log('Spatial Extent errors:', errors.spatialExtent);
                    console.log('License errors:', errors.license);
                    console.log('Price errors:', errors.price);
                    console.log('Category errors:', errors.category);
                    console.log('--------------------------------------------------------------------');
                    console.log('TOTAL ERRORS:', errors.totalErrors());
                    console.log('OFFERINGS NOT REGISTERED:', errors.notRegistered);
                    console.log('OFFERINGS DIFFERENT FROM ORIGINAL:', errors.different + '/' + errors.amountTested);
                    console.log('--------------------------------------------------------------------');
                    console.log('Press any key to delete offerings');
                    process.stdin.setRawMode(true);
                    process.stdin.resume();
                    process.stdin.on('data', () => {
                        api.deleteAllOfferings();
                    });
                });
            });
        });
    });
});

function getAndCompare(consumer: any, ids1: Array<string>, ids2: Array<string>, errors: QualityTestErrors,
                       index: number): Promise<any> {
    return new Promise((resolve, reject) => {
        if (index >= ids1.length) {
            resolve(errors);
        } else {
            consumer.get(ids1[index]).then((data1) => {
                consumer.get(ids2[index]).then((data2) => {
                    console.log('Comparing original and converted for:', ids1[index]);
                    compareOfferings(data1.offering, data2.offering, errors);
                    getAndCompare(consumer, ids1, ids2, errors, ++index).then(() => {
                        resolve(errors);
                    });
                }).catch((err) => {
                    console.log('Error retrieving', ids2[index]);
                    console.log(err);
                    errors.incrementNotRegistered();
                    getAndCompare(consumer, ids1, ids2, errors, ++index).then(() => {
                        resolve(errors);
                    });
                });
            }).catch((err) => {
                console.log('Error retrieving', ids1[index]);
                console.log(err);
                getAndCompare(consumer, ids1, ids2, errors, ++index).then(() => {
                    resolve(errors);
                });
            });
        }
    });
}

function compareOfferings(o1: any, o2: any, errors: QualityTestErrors) {
    let different = false;

    if (!o2) {
        console.log('Undefined offering.');
        errors.incrementNotRegistered();
        return;
    }

    // Compare endpoints
    if (o1.endpoints.length !== o2.endpoints.length) {
        errors.incrementEndpoint();
        console.log('Different amount of endpoints for', o1.id, 'and', o2.id);
        different = true;
    } else {
        for (let i = 0; i < o1.endpoints; i++) {
            let ep1 = o1.endpoints[i];
            let ep2 = o2.endpoints[i];
            if (ep1.uri !== ep2.uri
                || ep1.endpointType !== ep2.endpointType
                || ep1.accessInterfaceType !== ep2.accessInterfaceType) {
                errors.incrementEndpoint();
                console.log('Different endpoint #' + i, 'for', o1.id, 'and', o2.id);
                different = true;
            }
        }
    }

    // Compare inputs
    if (o1.inputs.length !== o2.inputs.length) {
        errors.incrementInput();
        console.log('Different amount of inputs for', o1.id, 'and', o2.id);
        different = true;
    } else {
        for (let i = 0; i < o1.inputs; i++) {
            let i1 = o1.inputs[i];
            let i2 = o2.inputs[i];
            if (i1.name !== i2.name
                || replaceCommonPrefix(i1.rdfAnnotation.uri) !== replaceCommonPrefix(i2.rdfAnnotation.uri)) {
                errors.incrementInput();
                console.log('Different input #' + i, 'for', o1.id, 'and', o2.id);
                different = true;
            }
        }
    }

    // Compare outputs
    if (o1.outputs.length !== o2.outputs.length) {
        errors.incrementOutput();
        console.log('Different amount of outputs for', o1.id, 'and', o2.id);
        different = true;
    } else {
        for (let i = 0; i < o1.outputs; i++) {
            let i1 = o1.outputs[i];
            let i2 = o2.outputs[i];
            if (i1.name !== i2.name
                || replaceCommonPrefix(i1.rdfAnnotation.uri) !== replaceCommonPrefix(i2.rdfAnnotation.uri)) {
                errors.incrementOutput();
                console.log('Different output #' + i, 'for', o1.id, 'and', o2.id);
                different = true;
            }
        }
    }

    // Compare extents
    if (o1.spatialExtent.city !== o2.spatialExtent.city) {
        errors.incrementSpatialExtent();
        console.log('Different spatial extent (city) for', o1.id, 'and', o2.id);
        different = true;
    } else {
        let b1 = o1.spatialExtent.boundary;
        let b2 = o2.spatialExtent.boundary;
        if (b1 && b2 && b1.l1 && b1.l2 && b2.l1 && b2.l2 &&
            (b1.l1.lat !== b2.l1.lat || b1.l1.lng !== b2.l1.lng || b1.l2.lat !== b2.l2.lat || b1.l2.lng !== b2.l2.lng)) {
            errors.incrementSpatialExtent();
            console.log('Different spatial extent (boundary) for', o1.id, 'and', o2.id);
            different = true;
        }
    }

    // Compare licenses
    if (o1.license !== o2.license) {
        errors.incrementLicense();
        console.log('Different licenses for', o1.id, 'and', o2.id);
        different = true;
    }

    // Compare prices
    if (o1.price.pricingModel !== o2.price.pricingModel) {
        errors.incrementPrice();
        console.log('Different price (pricingModel) for', o1.id, 'and', o2.id);
        different = true;
    } else if (o1.price.money && o2.price.money) {
        if (o1.price.money.currency !== o2.price.money.currency) {
            errors.incrementPrice();
            console.log('Different price (currency) for', o1.id, 'and', o2.id);
            different = true;
        } else if (o1.price.money.amount !== o2.price.money.amount) {
            errors.incrementPrice();
            console.log('Different price (amount) for', o1.id, 'and', o2.id);
            different = true;
        }
    }

    // Compare categories
    if (o1.rdfAnnotation.uri !== o2.rdfAnnotation.uri) {
        errors.incrementCategory();
        console.log('Different categories for', o1.id, 'and', o2.id);
        different = true;
    }

    if (different) errors.incrementDifferent();
    errors.incrementAmountTested();
}

function replaceCommonPrefix(uri: string) {
    return uri.replace('schema:', 'https://schema.org/')
        .replace('mobility:', 'http://schema.big-iot.org/mobility/')
        .replace('environment:', 'http://schema.big-iot.org/environment/');
}