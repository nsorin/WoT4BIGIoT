import {Thing, Interaction, parseTDString} from "../thingweb.node-wot/packages/td-tools";
import {ThingAnalyzer} from "./thing-analyzer";
import {Gateway} from "./gateway";
import {OfferingManager} from "./offering-manager";
import {Configuration} from "./configuration";

class Api {

    private static CONFIG_SOURCE = "../config.json";

    private config = new Configuration();
    private thingAnalyzer = new ThingAnalyzer(this.config);
    private gateway = new Gateway(this.config);
    private offeringManager = new OfferingManager(this.config);

    private initComplete = false;

    constructor() {
        //TODO
    }

    /**
     * Initialize the API. Must be called before using the API methods.
     * @return {Promise<any>}
     */
    public init(): Promise<any> {
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
    public registerThings(tds: Array<any>): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.initComplete){
                reject('Configuration not initialized!');
            } else {
                // Parse all things
                let parsedThings: Array<Thing> = [];
                for (let i = 0; i < tds.length; i++) {
                    try {
                        let thing = parseTDString(tds[i]);
                        parsedThings.push(thing);
                    } catch (e) {
                        console.log('Could not parse thing at index', i, ':', e);
                    }
                }

                let directRegistration: Array<Thing> = [];
                let gatewayRegistration: Array<Thing> = [];
                // Use parsed things
                if (this.config.useMerge || this.config.useAggregate ||this.config.useHistory) {
                    gatewayRegistration = parsedThings;
                } else {
                    // Sort compatible and non compatible things
                    for (let i = 0; i < parsedThings.length; i++) {
                        if (this.thingAnalyzer.isThingDirectlyCompatible(parsedThings[i])) {
                            directRegistration.push(parsedThings[i]);
                        } else {
                            gatewayRegistration.push(parsedThings[i]);
                        }
                    }
                }
                this.registerThingsDirectly(directRegistration);
                this.registerThingsWithGateway(gatewayRegistration);
            }
        });
    }

    /**
     * Convert offerings to the TD format
     * @param {Array<string>} offeringIds Unique identifiers for offerings on the marketplace.
     * @return {Promise<any>}
     */
    public convertOfferings(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.initComplete){
                reject('Configuration not initialized!');
            } else {
                // TODO
            }
        });
    }

    /**
     * Directly register things on the marketplace (after checking they are compatible)
     * @param {Array<Thing>} things
     */
    private registerThingsDirectly(things: Array<Thing>): void {
        // TODO
    }

    /**
     * Initialize or update the gateway to register incompatible things or to use advanced features.
     * @param {Array<Thing>} things
     */
    private registerThingsWithGateway(things: Array<Thing>): void {
        this.gateway.init().then((gateway) => {
            //TODO: Do stuff
        });
    }
}

module.exports = Api;