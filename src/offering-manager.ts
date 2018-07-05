import {Configuration} from "./configuration";
import bigiot = require('../bigiot-js');
import {GatewayRoute} from "./gateway-route";
import {Thing} from "../thingweb.node-wot/packages/td-tools";
import {MetadataManager} from "./metadata-manager";
import sanitize = require('sanitize-filename');

/**
 * Class used to manage Offering registrations on the marketplace.
 */
export class OfferingManager {

    private readonly config: Configuration;

    private toRegister: Array<any> = [];
    private registered: Array<any> = [];
    private readonly baseUri: string;
    private readonly provider: any = null;
    private initDone: boolean = false;

    private static readonly ACCESS_TYPE = 'EXTERNAL';
    private static readonly ENDPOINT_TYPE_PREFIX = 'HTTP_';

    /**
     * Constructor. Init needs to be called.
     * @param {Configuration} config
     */
    constructor(config: Configuration) {
        this.config = config;
        this.baseUri = this.config.gateway.host + ':' + this.config.gateway.port;
        this.provider = new bigiot.provider(this.config.market.providerId, this.config.market.providerSecret,
            this.config.market.marketplaceUrlForProvider);
    }

    /**
     * Init method. Authenticate the provider to the marketplace.
     * @return {Promise<any>}
     */
    public init(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.initDone) {
                resolve(this);
            } else {
                this.provider.authenticate().then(() => {
                    console.log('Provider authentication successful for', this.config.market.providerId);
                    resolve(this);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add an offering based on a GatewayRoute. The Offering is added to the toRegister list, for future registration.
     * @param {GatewayRoute} route
     * @param {Array<Thing>} things
     * @param {Array<string>} propertyIndexes
     * @param {boolean} write
     * @param {string} actionIndex
     */
    public addOfferingForRoute(route: GatewayRoute, things: Array<Thing>, propertyIndexes?: Array<string>,
                               write?: boolean, actionIndex?: string) {
        // Reference thing: first of the array
        let refThing = things[0];
        let offering;
        if (things.length === 1) {
            if (actionIndex) {
                let action = refThing.actions[actionIndex];
                offering = new bigiot.offering(route.uri, MetadataManager.guessCategory(refThing, action));
                offering.license = MetadataManager.guessLicense(refThing, action);
                offering.price = MetadataManager.guessPrice(refThing, action);
                offering.extent = MetadataManager.guessSpatialExtent(refThing, action);
                offering.inputData = route.convertedInputSchema.concat(route.propertyFiltersSchema);
                offering.outputData = route.convertedOutputSchema;
            } else if (propertyIndexes.length === 1) {
                let property = refThing.properties[propertyIndexes[0]];
                offering = new bigiot.offering(route.uri, MetadataManager.guessCategory(refThing, property));
                offering.license = MetadataManager.guessLicense(refThing, property);
                offering.price = MetadataManager.guessPrice(refThing, property);
                offering.extent = MetadataManager.guessSpatialExtent(refThing, property);
                offering.inputData = route.convertedInputSchema.concat(route.propertyFiltersSchema);
                offering.outputData = route.convertedOutputSchema;
            } else {
                offering = new bigiot.offering(route.uri, MetadataManager.guessMergedCategory(refThing));
                offering.license = MetadataManager.guessMergedLicense(refThing);
                offering.price = MetadataManager.guessMergedPrice(refThing);
                offering.extent = MetadataManager.guessMergedSpatialExtent(refThing);
            }
        } else {
            offering = new bigiot.offering(route.uri, MetadataManager.guessAggregatedCategory(things, propertyIndexes, actionIndex));
            offering.license = MetadataManager.guessAggregatedLicense(things, propertyIndexes, actionIndex);
            offering.price = MetadataManager.guessAggregatedPrice(things, propertyIndexes, actionIndex);
            offering.extent = MetadataManager.guessAggregatedSpatialExtent(things, propertyIndexes, actionIndex);
        }
        offering.inputData = route.convertedInputSchema.concat(route.propertyFiltersSchema);
        offering.outputData = route.convertedOutputSchema;
        offering.endpoints = {
            uri: this.baseUri + '/' + route.uri,
            endpointType: OfferingManager.ENDPOINT_TYPE_PREFIX + route.method,
            accessInterfaceType: OfferingManager.ACCESS_TYPE
        };
        this.toRegister.push(offering);
    }

    /**
     * In case of direct compatibility between a Thing and the Offering model, add offerings based on the Thing. The
     * Offerings are added to the toRegister list, for future registration.
     * @param {Thing} thing
     */
    public addOfferingsForThing(thing: Thing) {
        // Convert properties
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                let property = thing.properties[i];
                let offering = new bigiot.offering(sanitize(thing.name + (property.writable ? '-Read-' : '-') + i),
                    MetadataManager.guessCategory(thing, property));
                offering.license = MetadataManager.guessLicense(thing, property);
                offering.price = MetadataManager.guessPrice(thing, property);
                offering.spatialExtent = MetadataManager.guessSpatialExtent(thing, property);
                // No input for readProperty
                offering.inputData = [];
                offering.outputData = OfferingManager.convertOutputSchema(property);
                offering.endpoints = OfferingManager.convertReadPropertyForm(property.forms);
                this.toRegister.push(offering);
                if (property.writable) {
                    let writeOffering = new bigiot.offering(sanitize(thing.name + '-Write-' + i),
                        MetadataManager.guessCategory(thing, property));
                    writeOffering.license = offering.license;
                    writeOffering.price = offering.price;
                    writeOffering.spatialExtent = offering.spatialExtent;
                    writeOffering.inputData = OfferingManager.convertInputSchema(property);
                    // No output for writeProperty
                    writeOffering.outputData = [];
                    writeOffering.endpoints = OfferingManager.convertWritePropertyForm(property.forms);
                    this.toRegister.push(writeOffering);
                }
            }
        }
        // Convert actions
        for (let i in thing.actions) {
            if (thing.actions.hasOwnProperty(i)) {
                let action = thing.actions[i];
                let offering = new bigiot.offering(sanitize(thing.name + '-' + i),
                    MetadataManager.guessCategory(thing, action));
                offering.license = MetadataManager.guessLicense(thing, action);
                offering.price = MetadataManager.guessPrice(thing, action);
                offering.extent = MetadataManager.guessSpatialExtent(thing, action);
                offering.inputData = OfferingManager.convertInputSchema(action.input);
                offering.outputData = OfferingManager.convertOutputSchema(action.output);
                offering.endpoints = OfferingManager.convertInvokeActionForm(action.forms);
                this.toRegister.push(offering);
            }
        }
    }

    /**
     * Check the list of offerings to register and register them on the marketplace.
     * @return {Promise<any>}
     */
    public registerOfferings() {
        return new Promise((resolve, reject) => {
            let promises = [];
            for (let i = 0; i < this.toRegister.length; i++) {
                promises.push(this.provider.register(this.toRegister[i]).then(() => {
                    console.log("Successfully registered offering " + this.toRegister[i].name);
                    this.registered.push(this.toRegister[i]);
                }, (err) => {
                    console.log("Failed to register offering " + this.toRegister[i].name);
                    // console.log(err);
                }));
            }
            Promise.all(promises).then(() => {
                this.toRegister = [];
                resolve();
            });
        });
    }

    /**
     * Unregister all offerings currently registered on the marketplace.
     * @param callback
     */
    public unregisterOfferings(callback) {
        let promises = [];
        for (let i = 0; i < this.registered.length; i++) {
            promises.push(this.provider.delete(this.registered[i]).then(() => {
                console.log("Successfully removed offering " + this.registered[i].name);
            }, (err) => {
                console.log("Failed to remove offering " + this.registered[i].name);
            }));
        }
        Promise.all(promises).then(() => {
            this.registered = [];
            callback();
        });
    }

    /**
     * Getter for toRegister.
     * @return {Array<any>}
     */
    public getOfferingsToRegister() {
        return this.toRegister;
    }

    /**
     * Getter for registered.
     * @return {Array<any>}
     */
    public getRegisteredOfferings() {
        return this.registered;
    }

    /**
     * Get the current provider's id.
     * @return {string}
     */
    public getProviderId(): string {
        return this.provider.id;
    }

    /**
     * In case of direct compatibility between an interaction and the offering mode, convert the input DataSchema to
     * an offering input.
     * @param schema
     * @return {Array<any>}
     */
    private static convertInputSchema(schema: any): Array<any> {
        let input = [];
        // Schema assumed to be compatible: no further checks
        for (let i in schema.properties) {
            if (schema.properties.hasOwnProperty(i)) {
                input.push({name: i, rdfUri: OfferingManager.getPropertyRdfUri(schema.properties[i])});
            }
        }
        return input;
    }

    /**
     * In case of direct compatibility between an interaction and the offering mode, convert the output DataSchema to
     * an offering input.
     * @param schema
     * @return {Array<any>}
     */
    private static convertOutputSchema(schema: any): Array<any> {
        let output = [];
        // Schema assumed to be compatible: no further checks
        for (let i in schema.items.properties) {
            if (schema.items.properties.hasOwnProperty(i)) {
                output.push({name: i, rdfUri: OfferingManager.getPropertyRdfUri(schema.items.properties[i])});
            }
        }
        return output;
    }

    /**
     * Get the Semantic annotation to use as rdfUri for the Offering.
     * @param property
     * @return {any}
     */
    private static getPropertyRdfUri(property: any) {
        let type = property['@type'];
        if (type) {
            if (Array.isArray(type) && type.length > 0) {
                return type[0];
            }
            if (typeof type === 'string') {
                return type;
            }
        }
        return MetadataManager.DATA_TYPE_CONVERSION.hasOwnProperty(property.type) ?
            MetadataManager.DATA_TYPE_CONVERSION[property.type] : MetadataManager.DEFAULT_DATA_TYPE;
    }

    /**
     * Convert Interaction Forms to offering endpoints (readProperty verb).
     * @param {Array<any>} forms
     * @return {any}
     */
    private static convertReadPropertyForm(forms: Array<any>): any {
        let form = null;
        if (forms.length === 1) {
            form = forms[0];
        } else {
            let done = false;
            for (let i = 0; i < forms.length; i++) {
                // If there is a form for this verb, this is the one (overrides any other).
                // If no form has been found yet and there is an unidentified form, consider it default.
                //TODO: Manage the case of multiple forms for the same verb
                if (forms[i].rel === 'readProperty' || (!done && !forms[i].rel)) {
                    form = forms[i];
                    done = true;
                }
            }
        }
        if (form !== null) {
            return {
                endpointType: form.hasOwnProperty('http:methodName') ? 'HTTP_' + form['http:methodName'] : 'HTTP_GET',
                accessInterfaceType: form.hasOwnProperty(MetadataManager.ACCESS_INTERFACE_TYPE) ?
                    form[MetadataManager.ACCESS_INTERFACE_TYPE] : OfferingManager.ACCESS_TYPE,
                uri: form.href
            };
        }
        return null;
    }

    /**
     * Convert Interaction Forms to offering endpoints (writeProperty verb).
     * @param {Array<any>} forms
     * @return {any}
     */
    private static convertWritePropertyForm(forms: Array<any>): any {
        let form = null;
        if (forms.length === 1) {
            form = forms[0];
        } else {
            let done = false;
            for (let i = 0; i < forms.length; i++) {
                // If there is a form for this verb, this is the one (overrides any other).
                // If no form has been found yet and there is an unidentified form, consider it default.
                //TODO: Manage the case of multiple forms for the same verb
                if (forms[i].rel === 'writeProperty' || (!done && !forms[i].rel)) {
                    form = forms[i];
                    done = true;
                }
            }
        }
        if (form !== null) {
            return {
                endpointType: form.hasOwnProperty('http:methodName') ? 'HTTP_' + form['http:methodName'] : 'HTTP_PUT',
                accessInterfaceType: form.hasOwnProperty(MetadataManager.ACCESS_INTERFACE_TYPE) ?
                    form[MetadataManager.ACCESS_INTERFACE_TYPE] : OfferingManager.ACCESS_TYPE,
                uri: form.href
            };
        }
        return null;
    }

    /**
     * Convert Interaction Forms to offering endpoints (invokeAction verb).
     * @param {Array<any>} forms
     * @return {any}
     */
    private static convertInvokeActionForm(forms: Array<any>): any {
        let form = null;
        if (forms.length === 1) {
            form = forms[0];
        } else {
            let done = false;
            for (let i = 0; i < forms.length; i++) {
                // If there is a form for this verb, this is the one (overrides any other).
                // If no form has been found yet and there is an unidentified form, consider it default.
                //TODO: Manage the case of multiple forms for the same verb
                if (forms[i].rel === 'invokeAction' || (!done && !forms[i].rel)) {
                    form = forms[i];
                    done = true;
                }
            }
        }
        if (form !== null) {
            return {
                endpointType: form.hasOwnProperty('http:methodName') ? 'HTTP_' + form['http:methodName'] : 'HTTP_POST',
                accessInterfaceType: form.hasOwnProperty(MetadataManager.ACCESS_INTERFACE_TYPE) ?
                    form[MetadataManager.ACCESS_INTERFACE_TYPE] : OfferingManager.ACCESS_TYPE,
                uri: form.href
            };
        }
        return null;
    }

}