import {Configuration} from "./configuration";
import bigiot = require('../bigiot-js');
import {Thing, EventFragment, PropertyFragment, ActionFragment, Form, serializeTD} from "../thingweb.node-wot/packages/td-tools";
import fs = require('fs');
import sanitize = require('sanitize-filename');
import {MetadataManager} from "./metadata-manager";

export class OfferingConverter {

    private static readonly PROVIDER_URI = "provider/";
    private static readonly OFFERING_URI = "offering/";

    private readonly config: Configuration;
    private readonly consumer: any;
    private initDone: boolean = false;

    constructor(config: Configuration) {
        this.config = config;
        this.consumer = new bigiot.consumer(this.config.market.consumerId,
            this.config.market.consumerSecret, this.config.market.marketplaceUrl);
    }

    public init(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.initDone) {
                resolve(this);
            } else {
                this.consumer.authenticate().then(() => {
                    console.log('Consumer authentication successful for', this.config.market.consumerId);
                    resolve(this);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    public convertOne(offeringId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.consumer.subscribe(offeringId).then((data) => {
                let offering = data.offering;
                let thing = new Thing();
                thing['@type'] = [MetadataManager.OFFERING_TYPE];
                thing.name = offering.name ? offering.name : offering.id;
                thing.id = this.config.market.marketplaceUrl + OfferingConverter.OFFERING_URI + offeringId;
                thing['@id'] = this.config.market.marketplaceUrl + OfferingConverter.OFFERING_URI + offeringId;
                this.generateInteraction(offering, thing);
                // TODO: Handle metadata
                resolve(thing);
            });
        });
    }

    public convertMultiple(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            let promises: Array<Promise<any>> = [];
            for (let i = 0; i < offeringIds.length; i++) {
                promises.push(this.consumer.subscribe(offeringIds[i]));
            }
            Promise.all(promises).then((values) => {
                let thing = new Thing();
                thing.name = "marketplace"; // Find a better nale / use constants
                for (let i = 0; i < values.length; i++) {
                    this.generateInteraction(values[i].offering, thing);
                }
                // TODO: Handle metadata
                resolve(thing);
            });
        });
    }

    public convertMultipleByProvider(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            let promises: Array<Promise<any>> = [];
            for (let i = 0; i < offeringIds.length; i++) {
                promises.push(this.consumer.subscribe(offeringIds[i]));
            }
            Promise.all(promises).then((values) => {
                let providerMap: any = {};
                for (let i = 0; i < values.length; i++) {
                    if (!providerMap.hasOwnProperty(values[i].offering.provider.id)) {
                        // Init a new thing for this provider if it does not exist yet
                        let providerId = values[i].offering.provider.id;
                        providerMap[providerId] = new Thing();
                        providerMap[providerId].name = providerId;
                        providerMap[providerId]['@type'] = [MetadataManager.PROVIDER_TYPE];
                        providerMap[providerId].id = this.config.market.marketplaceUrl
                            + OfferingConverter.PROVIDER_URI + providerId;
                        providerMap[providerId]['@id'] = this.config.market.marketplaceUrl
                            + OfferingConverter.PROVIDER_URI + providerId;
                    }
                    this.generateInteraction(values[i].offering, providerMap[values[i].offering.provider.id]);
                    // TODO: Handle additional metadata
                }
                resolve(providerMap.values());
            });
        });
    }

    private generateInteraction(offering: any, thing: Thing): any {
        let endpoint = offering.endpoints.length > 0 ? offering.endpoints[0] : null;
        if (!endpoint) {
            throw 'No endpoint found, cannot generate interaction';
        }
        // Create interaction name
        let name = offering.name ? sanitize(offering.name) : sanitize(offering.id);
        let uri = this.config.market.marketplaceUrl + OfferingConverter.OFFERING_URI + offering.id;
        // Create forms
        let forms: Array<Form> = OfferingConverter.convertEndpointsToForm(offering.endpoints);
        // Identify interaction pattern
        if (endpoint.endpointType === 'WEBSOCKET') {
            // Then this is an event
            let event = new EventFragment();
            event.forms = forms;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(event, offering);
            event['@id'] = uri;
            thing.events[name] = event;
        } else if ((!offering.inputs || offering.inputs.length === 0) && offering.outputs && offering.outputs.length > 0
            && endpoint.endpointType === 'HTTP_GET') {
            // Then this is a property (read mode)
            let property = new PropertyFragment();
            property.writable = false;
            property.observable = false;
            Object.assign(property, OfferingConverter.convertOutputSchemaSimple(offering.outputs));
            property.forms = forms;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(property, offering);
            property['@id'] = uri;
            thing.properties[name] = property;
        } else if ((!offering.outputs || offering.outputs.length === 0) && offering.inputs && offering.inputs.length > 0
            && endpoint.endpointType === 'HTTP_PUT') {
            // Then this is a property (write mode)
            let property = new PropertyFragment();
            property.readable = false;
            property.observable = false;
            property.forms = forms;
            Object.assign(property, OfferingConverter.convertInputSchemaSimple(offering.inputs));
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(property, offering);
            property['@id'] = uri;
            thing.properties[name] = property;
        } else {
            // Then this is an action (default)
            let action = new ActionFragment();
            action.input = OfferingConverter.convertInputSchemaSimple(offering.inputs);
            action.output = OfferingConverter.convertOutputSchemaSimple(offering.outputs);
            action.forms = forms;
            // BIG IoT Metadata
            OfferingConverter.addBigIotMetadata(action, offering);
            action['@id'] = uri;
            thing.actions[name] = action;
        }
    }

    private static addBigIotMetadata(obj: any, offering) {
        obj[MetadataManager.PRICE] = {
            [MetadataManager.PRICING_MODEL]: offering.price.pricingModel,
            [MetadataManager.MONEY]: offering.price.money ? {
                [MetadataManager.CURRENCY]: offering.price.money.currency,
                [MetadataManager.AMOUNT]: offering.price.money.amount
            } : null
        };
        obj[MetadataManager.LICENSE] = offering.license;
        obj[MetadataManager.CATEGORY] = offering.rdfAnnotation.uri;
        obj[MetadataManager.SPATIAL_EXTENT] = {
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
            } : null
        };
    }

    private static convertInputSchemaSimple(input: Array<any>): any {
        let schema = {
            type: 'object',
            properties: {}
        };
        for (let i = 0; i < input.length; i++) {
            schema.properties[input[i].name] = {
                '@type': [input[i].rdfAnnotation.uri],
                type: 'string'
            };
        }
        return schema;
    }

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
                '@type': [output[i].rdfAnnotation.uri],
                type: 'string'
            };
        }
        return schema;
    }

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