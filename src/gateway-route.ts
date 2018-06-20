import Thing from "../thingweb.node-wot/packages/td-tools/src/thing-description";
import sanitize = require('sanitize-filename');
import request = require('request');
import coap = require('coap');
import urlParser = require('url');

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

    constructor(form: WoT.Form, verb: InteractionVerb) {
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
    }

    /**
     * Make a request to a Thing using the data stored and the parameters provided
     * @param params
     * @return {Promise<any>}
     */
    public makeRequest(params: any): Promise<any> {
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
                                    resolve(body && body !== "" ? JSON.parse(body) : {});
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                    resolve(body);
                                }
                            }
                        });
                        break;
                    case Method.POST:
                        request.post(this.sourceParams, (err, res, body) => {
                            if (err || (res.statusCode !== 200 && res.statusCode !== 204)) {
                                console.log('Failed to POST with params', this.sourceParams);
                                reject(err);
                            } else {
                                try {
                                    resolve(body && body !== "" ? JSON.parse(body) : {});
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                    resolve(body);
                                }
                            }
                        });
                        break;
                    case Method.PUT:
                        request.put(this.sourceParams, (err, res, body) => {
                            if (err || (res.statusCode !== 200 && res.statusCode !== 204)) {
                                console.log('Failed to PUT with params', this.sourceParams);
                                reject(err);
                            } else {
                                try {
                                    resolve(body && body !== "" ? JSON.parse(body) : {});
                                } catch (e) {
                                    console.log('Warning: Body could not be parsed, returning raw output.');
                                    resolve(body);
                                }
                            }
                        });
                        break;
                }
            } else if (this.sourceProtocol === Protocol.COAP) {
                let coapRq = coap.request(this.sourceParams);
                if (this.sourceMethod === Method.POST || this.sourceMethod === Method.PUT) {
                    coapRq.write(params);
                }
                coapRq.on('response', (res) => {
                    let payload = res.payload.toString();
                    try {
                        resolve(payload && payload !== "" ? JSON.parse(payload) : {});
                    } catch (e) {
                        console.log('Warning: Payload could not be parsed, returning raw output.');
                        resolve(payload);
                    }
                });
                coapRq.end();
            }
        });
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
     * Output schema to register in the offering
     */
    public convertedOutputSchema: any;
    /**
     * Input schema to register in the offering
     */
    public convertedInputSchema: any;
    /**
     * Is the route valid
     * @type {boolean}
     */
    public valid = true;
    /**
     * Registered status
     * @type {boolean}
     */
    public registered = false;
    /**
     * Function to use to convert the Offering's input to the Thing's schema
     */
    private inputConverter;
    /**
     * Function to use to convert the Thing's output to the Offering's schema
     */
    private outputConverter;
    /**
     * Information required to make the requests to the Thing
     * @type {any[]}
     */
    private requests: Array<Array<RequestToThing>> = [];

    /**
     *
     * @param {Array<Thing>} things Things used by the route. They MUST be all identical!
     * @param {Array<number>} propertyIndexes
     * @param {boolean} write
     * @param {number} actionIndex
     */
    constructor(things: Array<Thing>, propertyIndexes: Array<number>, write?: boolean, actionIndex?: number) {
        // Set up URI and method
        if (propertyIndexes.length === 0 && !isNaN(actionIndex)) {
            // No property and an action
            this.uri = sanitize(things[0].name + '-' + things[0].actions[actionIndex].label);
            this.method = Method.POST;
        } else if (propertyIndexes.length === 1) {
            // Read or write?
            if (write) {
                this.uri = sanitize(things[0].name + '-Write-' + things[0].properties[propertyIndexes[0]].label);
                this.method = Method.POST; // Should use PUT once the marketplace supports it
            } else {
                this.uri = sanitize(things[0].name + '-Read-' + things[0].properties[propertyIndexes[0]].label);
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
                if (isNaN(actionIndex)) {
                    // In this case, properties are registered
                    for (let j = 0; j < propertyIndexes.length; j++) {
                        let property = things[i].properties[propertyIndexes[j]];
                        let verb = write? InteractionVerb.WRITE : InteractionVerb.READ;
                        let form = this.getRelevantForm(property.forms, verb);
                        if (form) {
                            thingRequests.push(new RequestToThing(form, verb));
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
                         thingRequests.push(new RequestToThing(form, InteractionVerb.INVOKE));
                    } else {
                        console.log('ERROR: Invalid interactions provided, no route can be created!');
                        this.valid = false;
                    }
                }
                this.requests.push(thingRequests);
            }
        }

        if (this.valid) {
            // TODO: Schema and data conversion
        }
    }

    /**
     * Access the route's interaction. If aggregating and an id is provided, use it.
     * @param params
     * @param {number} id
     * @return {Promise<any>}
     */
    public access(params: any, id?: number): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.valid) {
                reject('Route is invalid, cannot be used.');
            } else {
                // Prepare input parameters to fit the Thing's expected schema
                this.inputConverter(params).then((input) => {
                    if (input) {
                        input = typeof input === 'object' ? JSON.stringify(input) : input;
                    }
                    // Use id if valid
                    if (this.requests.length > 1 && !isNaN(id)) {
                        if (id < this.requests.length) {
                            // Prepare promise array in case multiple requests have to be made
                            let promises: Array<Promise<any>> = [];
                            for (let i = 0; i < this.requests[id].length; i++) {
                                // For each required request, add the request to the promise array
                                promises.push(this.requests[id][i].makeRequest(input).then((output) => {
                                    return this.outputConverter(output);
                                }));
                            }
                            // Once all request have a response, unwrap the output and resolve it
                            Promise.all(promises).then((outputValues) => {
                                let final = {};
                                for (let i = 0; i < outputValues.length; i++) {
                                    Object.assign(final, outputValues[i]);
                                }
                                resolve([final]);
                            });
                        } else {
                            reject('Invalid id provided');
                        }
                    } else {
                        // For each Thing, get all the desired interactions
                        let finalPromises: Array<Promise<any>> = [];
                        for (let i = 0; i < this.requests.length; i++) {
                            let promises: Array<Promise<any>> = [];
                            for (let j = 0; j < this.requests[i].length; j++) {
                                promises.push(this.requests[id][i].makeRequest(input).then((output) => {
                                    return this.outputConverter(output);
                                }));
                                finalPromises.push(Promise.all(promises));
                            }
                        }
                        // Once all requests have a response, unwrap the output and resolve it
                        let finalArray = [];
                        Promise.all(finalPromises).then((outputValues) => {
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
                                // The final output is an array with an item for each Thing
                                finalArray.push(finalObject);
                            }
                            resolve(finalArray);
                        });
                    }
                });
            }
        });
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
}