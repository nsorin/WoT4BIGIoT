"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const td_tools_1 = require("../thingweb.node-wot/packages/td-tools");
const thing_analyzer_1 = require("./thing-analyzer");
const gateway_1 = require("./gateway");
const offering_manager_1 = require("./offering-manager");
const configuration_1 = require("./configuration");
class Api {
    constructor() {
        this.config = new configuration_1.Configuration();
        this.thingAnalyzer = new thing_analyzer_1.ThingAnalyzer(this.config);
        this.gateway = new gateway_1.Gateway(this.config);
        this.offeringManager = new offering_manager_1.OfferingManager(this.config);
        this.initComplete = false;
        //TODO
    }
    init() {
        return new Promise((resolve, reject) => {
            this.config.init(Api.CONFIG_SOURCE).then(() => {
                this.initComplete = true;
                resolve(this);
            }).catch((e) => {
                reject('Config error:' + e);
            });
        });
    }
    /**
     * Register things on the marketplace. If there is no direct compatibility with the Offering model or if,
     * the API is configured to use additional features requiring it, a gateway is set up.
     * @param {Array<string>} tds JSON TDs (not parsed)
     * @return {Promise<any>}
     */
    registerThings(tds) {
        return new Promise((resolve, reject) => {
            if (!this.initComplete) {
                reject('Configuration not initialized!');
            }
            else {
                // Parse all things
                let parsedThings = [];
                for (let i = 0; i < tds.length; i++) {
                    try {
                        let thing = td_tools_1.parseTDString(tds[i]);
                        parsedThings.push(thing);
                    }
                    catch (e) {
                        console.log('Could not parse thing at index', i, ':', e);
                    }
                }
                let directRegistration = [];
                let gatewayRegistration = [];
                // Use parsed things
                if (this.config.useMerge || this.config.useAggregate || this.config.useHistory) {
                    gatewayRegistration = parsedThings;
                }
                else {
                    // Sort compatible and non compatible things
                    for (let i = 0; i < parsedThings.length; i++) {
                        if (this.thingAnalyzer.isThingDirectlyCompatible(parsedThings[i])) {
                            directRegistration.push(parsedThings[i]);
                        }
                        else {
                            gatewayRegistration.push(parsedThings[i]);
                        }
                    }
                }
                this.registerThingsDirectly(directRegistration);
                this.registerThingsWithGateway(gatewayRegistration);
            }
        });
    }
    convertOfferings(offeringIds) {
        return new Promise((resolve, reject) => {
            if (!this.initComplete) {
                reject('Configuration not initialized!');
            }
            else {
                // TODO
            }
        });
    }
    registerThingsDirectly(things) {
        // TODO
    }
    registerThingsWithGateway(things) {
        this.gateway.init().then((gateway) => {
            //TODO: Do stuff
        });
    }
}
Api.CONFIG_SOURCE = "../config.json";
module.exports = Api;
//# sourceMappingURL=api.js.map