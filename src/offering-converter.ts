import {Configuration} from "./configuration";
import bigiot = require('../bigiot-js');
import {Thing, EventFragment, PropertyFragment, ActionFragment, Form} from "../thingweb.node-wot/packages/td-tools";
import sanitize = require('sanitize-filename');
import {MetadataManager} from "./metadata-manager";

/**
 * Class used to convert Offerings to Things.
 */
export class OfferingConverter {

    private static readonly PROVIDER_URI = "provider/";
    private static readonly OFFERING_URI = "offering/";
    private static readonly SEMANTIC_TYPE = "@type";
    private static readonly SEMANTIC_ID = "@id";

    private readonly _consumer: any;
    private _initComplete: boolean = false;

    /**
     * Constructor. Init needs to be called.
     * @param {Configuration} _config Configuration used by the API.
     */
    constructor(
        private _config: Configuration
    ) {
        this._consumer = new bigiot.consumer(this._config.market.consumerId,
            this._config.market.consumerSecret, this._config.market.marketplaceUrlForConsumer);
    }

    /**
     * Init method: authenticate the consumer if not done already.
     * @return {Promise<any>}
     */
    public init(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._initComplete) {
                resolve(this);
            } else {
                this._consumer.authenticate().then(() => {
                    console.log('Consumer authentication successful for', this._config.market.consumerId);
                    resolve(this);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Convert one Offering using its id as input. Produces one Thing for one Offering as output.
     * @param {string} offeringId
     * @return {Promise<any>}
     */
    public convertOne(offeringId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // Get the offering from the marketplace
            this._consumer.get(offeringId).then((offering) => {
                let thing = new Thing();
                thing[OfferingConverter.SEMANTIC_TYPE] = [MetadataManager.OFFERING_TYPE];
                thing.name = offering.name ? offering.name : offering.id;
                thing.id = this._config.market.marketplaceUrlForConsumer + OfferingConverter.OFFERING_URI + offeringId;
                thing[OfferingConverter.SEMANTIC_ID] = this._config.market.marketplaceUrlForConsumer + OfferingConverter.OFFERING_URI + offeringId;
                try {
                    this.generateInteraction(offering, thing);
                } catch (e) {
                    console.log('Error in interaction generation:', e);
                }
                // TODO: Handle metadata
                resolve(thing);
            }).catch((err) => {
                console.log('Could not get the offering from the marketplace.');
                console.log(err);
            });
        });
    }

    /**
     * Convert multiple Offerings at once. Produces only one Thing for all offerings.
     * @param {Array<string>} offeringIds
     * @return {Promise<any>}
     */
    public convertMultiple(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            let promises: Array<Promise<any>> = [];
            for (let i = 0; i < offeringIds.length; i++) {
                promises.push(this._consumer.get(offeringIds[i]));
            }
            Promise.all(promises).then((offerings) => {
                let thing = new Thing();
                thing.name = "marketplace"; // Find a better nale / use constants
                for (let i = 0; i < offerings.length; i++) {
                    try {
                        this.generateInteraction(offerings[i], thing);
                    } catch (e) {
                        console.log('Error in interaction generation:', e);
                    }
                }
                // TODO: Handle metadata
                resolve(thing);
            }).catch((err) => {
                console.log('Could not get the offering from the marketplace.');
                console.log(err);
            });
        });
    }

    /**
     * Convert multiple Offerings at once. Produces one Thing for each identified provider in the offerings.
     * @param {Array<string>} offeringIds
     * @return {Promise<any>}
     */
    public convertMultipleByProvider(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            let promises: Array<Promise<any>> = [];
            for (let i = 0; i < offeringIds.length; i++) {
                promises.push(this._consumer.get(offeringIds[i]));
            }
            Promise.all(promises).then((offerings) => {
                let providerMap: any = {};
                for (let i = 0; i < offerings.length; i++) {
                    if (!providerMap.hasOwnProperty(offerings[i].provider.id)) {
                        // Init a new thing for this provider if it does not exist yet
                        let providerId = offerings[i].provider.id;
                        providerMap[providerId] = new Thing();
                        providerMap[providerId].name = providerId;
                        providerMap[providerId][OfferingConverter.SEMANTIC_TYPE] = [MetadataManager.PROVIDER_TYPE];
                        providerMap[providerId].id = this._config.market.marketplaceUrlForConsumer
                            + OfferingConverter.PROVIDER_URI + providerId;
                        providerMap[providerId][OfferingConverter.SEMANTIC_ID] = this._config.market.marketplaceUrlForConsumer
                            + OfferingConverter.PROVIDER_URI + providerId;
                    }
                    try {
                        this.generateInteraction(offerings[i], providerMap[offerings[i].provider.id], true);
                    } catch (e) {
                        console.log('Error in interaction generation:', e);
                    }
                    // TODO: Handle additional metadata
                }
                resolve(Object.keys(providerMap).map(key => providerMap[key]));
            }).catch((err) => {
                console.log('Could not get the offering from the marketplace.');
                console.log(err);
            });
        });
    }

    get consumer(): string {
        return this._consumer;
    }

    /**
     * Generate and append an interaction to a Thing based on an offering.
     * @param offering
     * @param {Thing} thing
     * @param {boolean} removeProviderName
     * @return {any}
     */
    private generateInteraction(offering: any, thing: Thing, removeProviderName: boolean = false): any {
        let endpoint = offering.endpoints.length > 0 ? offering.endpoints[0] : undefined;
        if (!endpoint) {
            throw 'No endpoint found, cannot generate interaction';
        }
        // Create interaction name
        let name = sanitize(removeProviderName ? offering.id.replace(offering.provider.id + '-', '') : offering.id);
        let uri = this._config.market.marketplaceUrlForConsumer + OfferingConverter.OFFERING_URI + offering.id;
        // Create forms
        let forms: Array<Form> = OfferingConverter.convertEndpointsToForm(offering.endpoints);
        // Identify interaction pattern
        if (endpoint.endpointType === 'WEBSOCKET') {
            // Then this is an event
            let event = new EventFragment();
            event.forms = forms;
            event.label = offering.name;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(event, offering);
            event[OfferingConverter.SEMANTIC_ID] = uri;
            thing.events[name] = event;
        } else if ((!offering.inputs || offering.inputs.length === 0) && offering.outputs && offering.outputs.length > 0
            && endpoint.endpointType === 'HTTP_GET') {
            // Then this is a property (read mode)
            let property = new PropertyFragment();
            property.writable = false;
            property.observable = false;
            Object.assign(property, OfferingConverter.convertOutputSchemaSimple(offering.outputs));
            property.forms = forms;
            property.label = offering.name;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(property, offering);
            property[OfferingConverter.SEMANTIC_ID] = uri;
            thing.properties[name] = property;
        } else if ((!offering.outputs || offering.outputs.length === 0) && offering.inputs && offering.inputs.length > 0
            && endpoint.endpointType === 'HTTP_PUT') {
            // Then this is a property (write mode)
            let property = new PropertyFragment();
            property.readable = false;
            property.observable = false;
            property.forms = forms;
            property.label = offering.name;
            Object.assign(property, OfferingConverter.convertInputSchemaSimple(offering.inputs));
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(property, offering);
            property[OfferingConverter.SEMANTIC_ID] = uri;
            thing.properties[name] = property;
        } else {
            // Then this is an action (default)
            let action = new ActionFragment();
            action.input = OfferingConverter.convertInputSchemaSimple(offering.inputs);
            action.output = OfferingConverter.convertOutputSchemaSimple(offering.outputs);
            action.forms = forms;
            action.label = offering.name;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(action, offering);
            action[OfferingConverter.SEMANTIC_ID] = uri;
            thing.actions[name] = action;
        }
    }

    /**
     * Adds the marketplace metadata to the thing, using full URIs.
     * @param obj
     * @param offering
     */
    private static addBigIotMetadata(obj: any, offering) {
        obj[MetadataManager.PRICE] = {
            [MetadataManager.PRICING_MODEL]: offering.price.pricingModel,
            [MetadataManager.MONEY]: offering.price.money ? {
                [MetadataManager.CURRENCY]: offering.price.money.currency,
                [MetadataManager.AMOUNT]: offering.price.money.amount
            } : undefined
        };
        obj[MetadataManager.LICENSE] = offering.license;
        obj[MetadataManager.CATEGORY] = offering.rdfAnnotation.uri;
        obj[MetadataManager.SPATIAL_EXTENT] = offering.spatialExtent ? {
            [MetadataManager.CITY]: offering.spatialExtent.city,
            [MetadataManager.BOUNDARY]: offering.spatialExtent.boundary ? {
                [MetadataManager.LAT_LONG_1]: {
                    [MetadataManager.B_LATITUDE]: offering.spatialExtent.boundary.l1.lat,
                    [MetadataManager.B_LONGITUDE]: offering.spatialExtent.boundary.l1.lng
                },
                [MetadataManager.LAT_LONG_2]: {
                    [MetadataManager.B_LATITUDE]: offering.spatialExtent.boundary.l2.lat,
                    [MetadataManager.B_LONGITUDE]: offering.spatialExtent.boundary.l2.lng
                }
            } : undefined
        } : undefined;
    }

    /**
     * Convert the Offering input schema to a Thing DataSchema.
     * @param {Array<any>} input
     * @return {any}
     */
    private static convertInputSchemaSimple(input: Array<any>): any {
        let schema = {
            type: 'object',
            properties: {}
        };
        for (let i = 0; i < input.length; i++) {
            schema.properties[input[i].name] = {
                [OfferingConverter.SEMANTIC_TYPE]: [input[i].rdfAnnotation.uri],
                type: 'string'
            };
        }
        return schema;
    }

    /**
     * Convert the Offering output schema to a Thing DataSchema.
     * @param {Array<any>} output
     * @return {any}
     */
    private static convertOutputSchemaSimple(output: Array<any>): any {
        let schema = {
            type: 'array',
            items: {
                type: 'object',
                properties: {}
            }
        };
        for (let i = 0; i < output.length; i++) {
            schema.items.properties[output[i].name] = {
                [OfferingConverter.SEMANTIC_TYPE]: [output[i].rdfAnnotation.uri],
                type: 'string'
            };
        }
        return schema;
    }

    /**
     * Convert the list of endpoints for an offering to a list of forms for an interaction.
     * @param {Array<any>} endpoints
     * @return {Array<Form>}
     */
    private static convertEndpointsToForm(endpoints: Array<any>): Array<Form> {
        let forms: Array<Form> = [];
        for (let i = 0; i < endpoints.length; i++) {
            let form = new Form();
            form.href = endpoints[i].uri;
            form.mediaType = "application/json";
            switch (endpoints[i].endpointType) {
                case 'HTTP_GET':
                    form['http:methodName'] = 'GET';
                    break;
                case 'HTTP_POST':
                    form['http:methodName'] = 'POST';
                    break;
                case 'HTTP_PUT':
                    form['http:methodName'] = 'PUT';
                    break;
                case 'COAP_GET':
                    form['coap:methodCode'] = 'GET';
                    break;
                case 'COAP_POST':
                    form['coap:methodCode'] = 'POST';
                    break;
                case 'COAP_PUT':
                    form['coap:methodCode'] = 'PUT';
                    break;
                case 'WEBSOCKET':
                    //TODO: Define what to do
                    break;
                default:
                    break;
            }
            form[MetadataManager.ACCESS_INTERFACE_TYPE] = endpoints[i].accessInterfaceType;
            forms.push(form);
        }
        return forms;
    }
}