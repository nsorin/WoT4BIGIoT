import Thing from "../thingweb.node-wot/packages/td-tools/src/thing-description";
import sanitize = require('sanitize-filename');
import request = require('request');
import coap = require('coap');
import urlParser = require('url');
import {MetadataManager} from "./metadata-manager";

enum Protocol {
    HTTP = 'HTTP',
    COAP = 'COAP'
}

export enum Method {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT'
}

export enum InteractionVerb {
    READ = 'readProperty',
    WRITE = 'writeProperty',
    INVOKE = 'invokeAction'
}

class RequestToThing {
    private readonly sourceParams;
    private readonly sourceProtocol: Protocol;
    private readonly sourceMethod: Method;
    private readonly sourceName: string;
    private readonly sourceInputSchema: any;
    private readonly sourceOutputSchema: any;

    constructor(form: WoT.Form, verb: InteractionVerb, sourceInputSchema: any, sourceOutputSchema: any, sourceName: string) {
        this.sourceInputSchema = sourceInputSchema;
        this.sourceOutputSchema = sourceOutputSchema;
        this.sourceName = sourceName;
        let url = form.href;
        // Guess protocol and method
        if (!url || url === "") {
            // TODO handle error
        } else if (form['http:methodName']) {
            // Then the protocol is HTTP
            this.sourceProtocol = Protocol.HTTP;
            if ((<any>Object).values(Method).includes(form['http:methodName'])) {
                this.sourceMethod = form['http:methodName'];
            } else {
                this.sourceMethod = Method.GET;
            }
        } else if (form['coap:methodCode']) {
            // Then the protocol is COAP
            this.sourceProtocol = Protocol.COAP;
            if ((<any>Object).values(Method).includes(form['coap:methodCode'])) {
                this.sourceMethod = form['coap:methodCode'];
            } else {
                this.sourceMethod = Method.GET;
            }
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
            this.sourceProtocol = Protocol.HTTP;
            if (verb === InteractionVerb.INVOKE) {
                this.sourceMethod = Method.POST;
            } else if (verb === InteractionVerb.WRITE) {
                this.sourceMethod = Method.PUT;
            } else {
                this.sourceMethod = Method.GET;
            }
        } else if (url.startsWith('coap://') || url.startsWith('coaps://')) {
            this.sourceProtocol = Protocol.COAP;
            if (verb === InteractionVerb.INVOKE) {
                this.sourceMethod = Method.POST;
            } else if (verb === InteractionVerb.WRITE) {
                this.sourceMethod = Method.PUT;
            } else {
                this.sourceMethod = Method.GET;
            }
        }

        // Create params
        if (this.sourceProtocol === Protocol.HTTP) {
            this.sourceParams = {
                url: url,
                headers: [{
                    name: 'content-type',
                    value: form.mediaType ? form.mediaType : 'application/json'
                }]
            };
        } else if (this.sourceProtocol === Protocol.COAP) {
            this.sourceParams = urlParser.parse(url);
        }
        // console.log('Created RequestToThing:', this);
    }

    /**
     * Make a request to a Thing using the data stored and the parameters provided
     * @param params
     * @return {Promise<any>}
     */
    public makeRequest(params: any): Promise<any> {
        console.log('Original input:', params);
        let input = RequestToThing.convertInputRecursive(this.sourceInputSchema, params, this.sourceName);
        if (input) {
            input = typeof input === 'object' ? JSON.stringify(input) : input;
        }
        console.log('Converted input:', input);
        return new Promise((resolve, reject) => {
            if (this.sourceProtocol === Protocol.HTTP) {
                switch (this.sourceMethod) {
                    case Method.GET:
                        request.get(this.sourceParams, (err, res, body) => {
                            if (err || (res.statusCode !== 200 && res.statusCode !== 204)) {
                                console.log('Failed to GET with params', this.sourceParams);
                                reject(err);
                            } else {
                                try {
                                    body = body && body !== "" ? JSON.parse(body) : {};
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                }
                                console.log('HTTP Get returned', body);
                                resolve(RequestToThing.convertOutputRecursive(this.sourceOutputSchema,
                                    body, this.sourceName));
                            }
                        });
                        break;
                    case Method.POST:
                        let httpPostParams = Object.assign({body: input}, this.sourceParams);
                        request.post(httpPostParams, (err, res, body) => {
                            if (err || (res.statusCode !== 200 && res.statusCode !== 204)) {
                                console.log('Failed to POST with params', this.sourceParams);
                                reject(err);
                            } else {
                                try {
                                    body = body && body !== "" ? JSON.parse(body) : {};
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                }
                                resolve(RequestToThing.convertOutputRecursive(this.sourceOutputSchema,
                                    body, this.sourceName));
                            }
                        });
                        break;
                    case Method.PUT:
                        let httpPutParams = Object.assign({body: input}, this.sourceParams);
                        request.put(httpPutParams, (err, res, body) => {
                            if (err || (res.statusCode !== 200 && res.statusCode !== 204)) {
                                console.log('Failed to PUT with params', this.sourceParams);
                                reject(err);
                            } else {
                                try {
                                    body = body && body !== "" ? JSON.parse(body) : {};
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                }
                                resolve(RequestToThing.convertOutputRecursive(this.sourceOutputSchema,
                                    body, this.sourceName));
                            }
                        });
                        break;
                }
            } else if (this.sourceProtocol === Protocol.COAP) {
                let coapRq = coap.request(this.sourceParams);
                if (this.sourceMethod === Method.POST || this.sourceMethod === Method.PUT) {
                    coapRq.write(input);
                }
                coapRq.on('response', (res) => {
                    let payload = res.payload.toString();
                    try {
                        payload = payload && payload !== "" ? JSON.parse(payload) : {};
                    } catch (e) {
                        console.log('Warning: Payload could not be parsed, returning raw output.');
                    }
                    resolve(RequestToThing.convertOutputRecursive(this.sourceOutputSchema,
                        payload, this.sourceName));
                });
                coapRq.end();
            }
        });
    }

    private static convertInputRecursive(schema: any, input: any, name) {
        if (!schema || !input) {
            return undefined;
        }
        let newInput = {};
        if (input[name] && input.length === 1) {
            // There is only one input, send it back
            return input[name];
        }
        let rdfType = schema['@type'];
        if (rdfType && rdfType.length > 0 && rdfType[0] !== "") {
            // There is a RDFType: the input
            newInput = input[name];
        } else if (schema.type === 'object') {
            for (let i in schema.properties) {
                if (schema.properties.hasOwnProperty(i)) {
                    // Put all inputs starting with the name + name of the properties into an additional level
                    // Potential bug if inputSchema includes _ and similar names
                    let parentStart = name + GatewayRoute.LEVEL_SEPARATOR;
                    let startsWith = parentStart + i;
                    for (let key in input) {
                        if (input.hasOwnProperty(key) && (key === startsWith || key.startsWith(startsWith + GatewayRoute.LEVEL_SEPARATOR))) {
                            let newKey = key.replace(parentStart, '');
                            newInput[newKey] = input[key];
                            delete input[key];
                        }
                    }
                    newInput[i] = RequestToThing.convertInputRecursive(schema.properties[i], newInput, i);

                }
            }
        } else {
            newInput = input[name];
        }
        return newInput;
    }

    private static convertOutputRecursive(schema: any, output: any, name) {
        if (!schema || (!output && output !== 0)) {
            return {};
        }
        let returnValue = {};
        let rdfType = schema['@type'];
        if (rdfType && rdfType.length > 0 && rdfType[0] !== "") {
            returnValue[name] = output;
        } else if (schema.type === 'object') {
            for (let i in schema.properties) {
                if (schema.properties.hasOwnProperty(i)) {
                    Object.assign(returnValue, RequestToThing.convertOutputRecursive(
                        schema.properties[i],
                        output[i],
                        name + GatewayRoute.LEVEL_SEPARATOR + i));
                }
            }
        } else {
            returnValue[name] = output;
        }
        console.log('Conversion output is', returnValue);
        return returnValue;
    }
}

export class GatewayRoute {

    /**
     * URI of the route once added to the Gateway
     */
    public uri: string;
    /**
     * Method of the route once added to the Gateway
     */
    public method: Method;
    /**
     * Input schema to register in the offering
     */
    public readonly convertedInputSchema: any = [];
    /**
     * Output schema to register in the offering
     */
    public readonly convertedOutputSchema: any = [];
    /**
     * Additional input schema for filters
     */
    public readonly propertyFiltersSchema: any = [];
    /**
     * Is the route valid
     * @type {boolean}
     */
    public readonly valid: boolean = true;
    /**
     * Registered status
     * @type {boolean}
     */
    public registered = false;
    /**
     * Information required to make the requests to the Thing
     * @type {any[]}
     */
    private requests: Array<Array<RequestToThing>> = [];
    /**
     * Indicate if the route needs an id as input to work (for writing operation when aggregating)
     * @type {boolean}
     */
    private readonly needsId: boolean = false;

    private static readonly ID_FIELD = {name: "id", rdfUri: "http://schema.org/identifier"};

    public static readonly LEVEL_SEPARATOR = "_";

    public static readonly MIN_PREFIX = "min_";
    public static readonly MAX_PREFIX = "max_";

    /**
     *
     * @param {Array<Thing>} things Things used by the route. They MUST be all identical!
     * @param {Array<number>} propertyIndexes
     * @param {boolean} write
     * @param {number} actionIndex
     * @param {boolean} usePropertyFilters
     */
    constructor(things: Array<Thing>, propertyIndexes: Array<string>, write?: boolean, actionIndex?: string,
                usePropertyFilters?: boolean) {
        // Set up URI and method
        if (propertyIndexes.length === 0 && actionIndex) {
            // No property and an action
            this.uri = sanitize(things[0].name + '-' + actionIndex);
            this.method = Method.POST;
            // If there is more than one thing, then we are aggregating and an id is needed.
            this.needsId = things.length > 1;
        } else if (propertyIndexes.length === 1) {
            // Read or write?
            if (write) {
                this.uri = sanitize(things[0].name + '-Write-' + propertyIndexes[0]);
                this.method = Method.POST; // Should use PUT once the marketplace supports it
                // If there is more than one thing, then we are aggregating and an id is needed.
                this.needsId = things.length > 1;
            } else {
                this.uri = sanitize(things[0].name + '-Read-' + propertyIndexes[0]);
                this.method = Method.GET;
            }
        } else if (propertyIndexes.length > 1) {
            // Read and merge properties
            this.uri = sanitize(things[0].name + '-Read');
            this.method = Method.GET;
        } else {
            console.log('ERROR: Invalid interactions provided, no route can be created!');
            this.valid = false;
        }

        if (this.valid) {
            for (let i = 0; i < things.length; i++) {
                let thingRequests: Array<RequestToThing> = [];
                if (!actionIndex) {
                    // In this case, properties are registered
                    for (let j = 0; j < propertyIndexes.length; j++) {
                        let property = things[i].properties[propertyIndexes[j]];
                        let verb = write ? InteractionVerb.WRITE : InteractionVerb.READ;
                        let form = this.getRelevantForm(property.forms, verb);
                        if (form) {
                            thingRequests.push(new RequestToThing(form, verb, write ? property : null,
                                write ? null : property, propertyIndexes[j]));
                        } else {
                            console.log('ERROR: Invalid interactions provided, no route can be created!');
                            this.valid = false;
                        }
                    }
                } else {
                    // In this case, an action is registered
                    let action = things[i].actions[actionIndex];
                    let form = this.getRelevantForm(action.forms, InteractionVerb.INVOKE);
                    if (form) {
                        thingRequests.push(new RequestToThing(form, InteractionVerb.INVOKE, action.input, action.output, actionIndex));
                    } else {
                        console.log('ERROR: Invalid interactions provided, no route can be created!');
                        this.valid = false;
                    }
                }
                this.requests.push(thingRequests);
            }
        }

        if (this.valid) {
            if (actionIndex) {
                // Convert the input schema for the action. Use first thing as reference since they are identical.
                this.convertedInputSchema = this.convertSchemaRecursive(things[0].actions[actionIndex].input,
                    actionIndex, things[0]['@context']);

                // Convert the output schema for the action. Use first thing as reference since they are identical.
                this.convertedOutputSchema = this.convertSchemaRecursive(things[0].actions[actionIndex].output,
                    actionIndex, things[0]['@context']);
            } else {
                if (write) {
                    // Can only write one property at once
                    this.convertedInputSchema = this.convertSchemaRecursive(things[0].properties[propertyIndexes[0]],
                        propertyIndexes[0], things[0]['@context']);
                    // No output in this case
                } else {
                    // No base input in this case. ID when aggregating is added later.
                    this.convertedOutputSchema = things.length > 1 ? [GatewayRoute.ID_FIELD] : [];
                    for (let i = 0; i < propertyIndexes.length; i++) {
                        this.convertedOutputSchema = this.convertedOutputSchema.concat(
                            this.convertSchemaRecursive(things[0].properties[propertyIndexes[i]],
                                propertyIndexes[i], things[0]['@context']));
                    }
                    // Add property filter inputs if needed
                    if (usePropertyFilters) {
                        for (let i = 0; i < this.convertedOutputSchema.length; i++) {
                            if (this.convertedOutputSchema[i].name !== GatewayRoute.ID_FIELD.name) {
                                // Min filter
                                this.propertyFiltersSchema.push({
                                    name: GatewayRoute.MIN_PREFIX + this.convertedOutputSchema[i].name,
                                    rdfUri: this.convertedOutputSchema[i].rdfUri
                                });
                                // Max filter
                                this.propertyFiltersSchema.push({
                                    name: GatewayRoute.MAX_PREFIX + this.convertedOutputSchema[i].name,
                                    rdfUri: this.convertedOutputSchema[i].rdfUri
                                });
                            }
                        }
                    }
                }
            }
            // If aggregating, add id as input field.
            if (things.length > 1) {
                this.convertedInputSchema.push(GatewayRoute.ID_FIELD);
            }
        }
        console.log('Converted input schema is', this.convertedInputSchema);
        console.log('Filter input schema is', this.propertyFiltersSchema);
        console.log('Converted output schema is', this.convertedOutputSchema);
        // console.log('Created GatewayRoute:', this);
    }

    /**
     * Access the route's interaction. If aggregating and an id is provided, use it.
     * @param params
     * @param {number} id
     * @param {any} propertyFilters
     * @return {Promise<any>}
     */
    public access(params: any, id?: number, propertyFilters?: any): Promise<any> {
        console.log('Accessing GatewayRoute', this.uri);
        return new Promise((resolve, reject) => {
            if (!this.valid) {
                reject('Route is invalid, cannot be used.');
            } else {
                // Use id if valid
                if (this.requests.length > 1 && !isNaN(id)) {
                    if (id < this.requests.length) {
                        // Prepare promise array in case multiple requests have to be made
                        let promises: Array<Promise<any>> = [];
                        for (let i = 0; i < this.requests[id].length; i++) {
                            // For each required request, add the request to the promise array
                            promises.push(this.requests[id][i].makeRequest(params));
                        }
                        // Once all request have a response, unwrap the output and resolve it
                        Promise.all(promises).then((outputValues) => {
                            let final: any = {};
                            for (let i = 0; i < outputValues.length; i++) {
                                Object.assign(final, outputValues[i]);
                            }
                            if (Object.keys(final).length > 0) {
                                // If there is no output, no need to add id
                                final.id = Number(id);
                            }
                            resolve([final]);
                        });
                    } else {
                        reject('Invalid id provided');
                    }
                } else if (this.needsId) {
                    // Route needs id but no valid id provided
                    reject('Id has to be provided');
                } else {
                    // For each Thing, get all the desired interactions
                    let finalPromises: Array<Promise<any>> = [];
                    for (let i = 0; i < this.requests.length; i++) {
                        let promises: Array<Promise<any>> = [];
                        for (let j = 0; j < this.requests[i].length; j++) {
                            promises.push(this.requests[i][j].makeRequest(params));
                        }
                        finalPromises.push(Promise.all(promises));
                    }
                    // Once all requests have a response, unwrap the output and resolve it
                    let finalArray = [];
                    Promise.all(finalPromises).then((outputValues) => {
                        console.log('All promises resolved with output:', outputValues);
                        // First layer: each value contains the values for one thing.
                        for (let i = 0; i < outputValues.length; i++) {
                            let finalObject: any = {};
                            // Second layer: each value contains the values for one interaction in one Thing
                            for (let j = 0; j < outputValues[i].length; j++) {
                                // Each Thing has a merged object for all its Interactions
                                Object.assign(finalObject, outputValues[i][j]);
                            }
                            // Add the id if needed
                            if (outputValues.length > 1) {
                                finalObject.id = i;
                            }

                            console.log("FILTERS RECEIVED:", propertyFilters);
                            // Evaluate filters
                            if (!propertyFilters || this.outputMeetsRequirements(finalObject, propertyFilters)) {
                                finalArray.push(finalObject);
                            }
                        }
                        console.log('Final array is', finalArray);
                        resolve(finalArray);
                    });
                }
            }
        });
    }

    private outputMeetsRequirements(output, filters): boolean {
        for (let i in filters) {
            if (filters.hasOwnProperty(i)) {
                if (i.startsWith(GatewayRoute.MIN_PREFIX)) {
                    let targetField = i.replace(GatewayRoute.MIN_PREFIX, '');
                    if (!output[targetField] || output[targetField] < filters[i]) return false;
                } else if (i.startsWith(GatewayRoute.MAX_PREFIX)) {
                    let targetField = i.replace(GatewayRoute.MAX_PREFIX, '');
                    if (!output[targetField] || output[targetField] > filters[i]) return false;
                }
            }
        }
        return true;
    }

    private getRelevantForm(forms: Array<WoT.Form>, verb: InteractionVerb): WoT.Form {
        if (forms.length === 1) {
            return forms[0];
        }
        let form = null;
        let done = false;
        for (let i = 0; i < forms.length; i++) {
            // If there is a form for this verb, this is the one (overrides any other).
            // If no form has been found yet and there is an unidentified form, consider it default.
            //TODO: Manage the case of multiple forms for the same verb
            if (forms[i].rel === verb || (!done && !forms[i].rel)) {
                form = forms[i];
                done = true;
            }
        }
        return form;
    }

    private convertSchemaRecursive(property: any, name: string, context: any) {
        if (!property) {
            return [];
        }
        let newSchema = [];
        let rdfType = property['@type'];
        if (rdfType && rdfType.length > 0 && rdfType[0] !== "") {
            newSchema = [{
                name: name,
                rdfUri: GatewayRoute.replacePrefix(rdfType[0], context)
            }];
        } else if (property.type === 'object') {
            for (let i in property['properties']) {
                if (property['properties'].hasOwnProperty(i)) {
                    newSchema = newSchema.concat(this.convertSchemaRecursive(
                        property['properties'][i], name + GatewayRoute.LEVEL_SEPARATOR + i,
                        context));
                }
            }
        } else if (property.type === 'array') {
            newSchema = [{
                name: name,
                rdfUri: MetadataManager.DEFAULT_ARRAY_TYPE
            }];
        } else {
            let semanticType = MetadataManager.DATA_TYPE_CONVERSION[property.type];
            if (semanticType) {
                newSchema = [{
                    name: name,
                    rdfUri: semanticType
                }];
            } else {
                newSchema = [{
                    name: name,
                    rdfUri: MetadataManager.DEFAULT_DATA_TYPE
                }];
                console.log('Warning: input field ', name, ' has no known type. Default type used.');
            }
        }
        return newSchema;
    }

    private convertInput(input: any) {
        console.log('Received input is:', input);
        // TODO Handle underscore in original name
        let result = {};
        for (let key in input) {
            if (input.hasOwnProperty(key) && this.fieldExistsInConvertedSchema(key, true)) {
                let levels = key.split(GatewayRoute.LEVEL_SEPARATOR);
                for (let i = 0; i < levels.length; i++) {
                    let currentLevel = result;
                    if (i === levels.length - 1) {
                        currentLevel[levels[i]] = input[key];
                    } else if (result.hasOwnProperty(levels[i])) {
                        currentLevel = currentLevel[levels[i]];
                    } else {
                        currentLevel[levels[i]] = {};
                        currentLevel = currentLevel[levels[i]];
                    }
                }
            }
        }
        return result;
    }

    private fieldExistsInConvertedSchema(fieldName: string, input: boolean): boolean {
        let schema = input ? this.convertedInputSchema : this.convertedOutputSchema;
        for (let i = 0; i < schema.length; i++) {
            if (schema[i].name === fieldName) return true;
        }
        return false;
    }

    private static replacePrefix(prefixed, context) {
        if (/^.+:[^, \\/]+.$/.test(prefixed)) {
            let prefix = prefixed.match(new RegExp('^[^, :\\/]+:'))[0];
            let key = prefix.substring(0, prefix.length - 1);
            for (let i = 0; i < context.length; i++) {
                if (typeof context[i] === 'object' && context[i].hasOwnProperty(key)) {
                    return prefixed.replace(prefix, context[i][key] + (context[i][key].slice(-1) === "/" ? '' : '#'));
                }
            }
        }
        return prefixed;
    }
}