import {Thing, parseTD} from "../thingweb.node-wot/packages/td-tools";
import {ThingAnalyzer} from "./thing-analyzer";
import {Gateway} from "./gateway";
import {OfferingManager} from "./offering-manager";
import {OfferingConverter} from "./offering-converter";
import {Configuration} from "./configuration";

export class Api {

    private static CONFIG_SOURCE = "../config.json";

    private config = new Configuration();
    private thingAnalyzer: ThingAnalyzer;
    private offeringManager: OfferingManager;
    private gateway: Gateway;
    private offeringConverter: OfferingConverter;

    private initComplete = false;

    private constructor() {
        // Nothing to do, call init
    }

    /**
     * Static method to call to init the API
     * @return {Promise<any>}
     */
    public static getApi(): Promise<any> {
        let api = new Api();
        return api.init();
    }

    /**
     * Initialize the API. Must be called before using the API methods.
     * @return {Promise<any>}
     */
    public init(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.config.init(Api.CONFIG_SOURCE).then(() => {
                this.thingAnalyzer = new ThingAnalyzer(this.config);
                this.offeringConverter = new OfferingConverter(this.config);
                this.offeringManager = new OfferingManager(this.config);
                this.offeringManager.init().then(() => {
                    this.gateway = new Gateway(this.config, this.offeringManager);
                    this.initComplete = true;
                    resolve(this);

                    // Exit handler
                    if (!this.config.keepOfferings) {
                        console.log('Setting up exit handler');
                        let exitHandler = () => {
                            this.offeringManager.unregisterOfferings(() => {
                                process.exit(1);
                            });
                        };
                        process.on('exit', exitHandler);
                        process.on('SIGINT', exitHandler);
                        process.on('SIGUSR1', exitHandler);
                        process.on('SIGUSR2', exitHandler);
                        process.on('uncaughtException', exitHandler);
                    }

                }).catch((err) => {
                    console.log('OfferingManager failed to init, error:', err);
                });
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
    public convertThings(tds: Array<string>) {
        if (!this.initComplete) {
            throw 'ERROR: Config not initialized!';
        } else {
            // Parse all things
            let parsedThings: Array<Thing> = [];
            for (let i = 0; i < tds.length; i++) {
                try {
                    let thing = parseTD(tds[i]);
                    parsedThings.push(thing);
                } catch (e) {
                    console.log('Could not parse thing at index', i, ':', e);
                }
            }
            console.log('PARSED EVERYTHING:', parsedThings.length, 'THINGS');

            let directRegistration: Array<Thing> = [];
            let gatewayRegistration: Array<Thing> = [];
            // Use parsed things
            if (this.config.useMerge || this.config.useAggregate || this.config.useHistory) {
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
            console.log(directRegistration.length, "things to register directly");
            console.log(gatewayRegistration.length, "things to register with gateway");
            this.convertThingsDirectly(directRegistration);
            this.convertThingsWithGateway(gatewayRegistration);
        }
    }

    public getOfferingsToRegister() {
        return this.offeringManager.getOfferingsToRegister();
    }

    public getRegisteredOfferings() {
        return this.offeringManager.getRegisteredOfferings();
    }

    public registerAllOfferings() {
        return this.offeringManager.registerOfferings();
    }

    public deleteAllOfferings() {
        return this.offeringManager.unregisterOfferings(() => {
            console.log('Deleted all offerings!');
        });
    }

    public disableOffering(name: string) {
        // TODO
    }

    /**
     * Convert offerings to the TD format
     * @param {Array<string>} offeringIds Unique identifiers for offerings on the marketplace.
     * @return {Promise<any>}
     */
    public convertOfferings(offeringIds: Array<string>): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.initComplete) {
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
    private convertThingsDirectly(things: Array<Thing>): void {
        let alreadyUsedNames: Array<string> = [];
        for (let i = 0; i < things.length; i++) {
            // Rename duplicates
            let fakeIndex = 0;
            while (alreadyUsedNames.indexOf(things[i].name) > -1) {
                console.log('Current thing name:', things[i].name, 'is already in use.');
                let fakeIndexString = String(fakeIndex);
                if (fakeIndex === 0) {
                    things[i].name = things[i].name + (++fakeIndex);
                } else {
                    things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                }
            }
            alreadyUsedNames.push(things[i].name);
            this.offeringManager.addOfferingsForThing(things[i]);
        }
    }

    /**
     * Initialize or update the gateway to register incompatible things or to use advanced features.
     * @param {Array<Thing>} things
     */
    private convertThingsWithGateway(things: Array<Thing>): void {
        this.gateway.init().then((gateway) => {
            if (this.config.useAggregate) {

                // Identify identical things
                let identicalThings: Array<Array<Thing>> = [];
                for (let i = 0; i < things.length; i++) {
                    let ok = false;
                    for (let j = 0; j < identicalThings.length; j++) {
                        if (this.thingAnalyzer.areThingsIdentical(identicalThings[j][0], things[i])) {
                            identicalThings[j].push(things[i]);
                            ok = true;
                        }
                    }
                    if (!ok) {
                        identicalThings.push([things[i]]);
                    }
                }
                // Register things by type
                let alreadyUsedNames: Array<string> = [];
                for (let i = 0; i < identicalThings.length; i++) {

                    // Rename duplicates
                    let fakeIndex = 0;
                    while (alreadyUsedNames.indexOf(identicalThings[i][0].name) > -1) {
                        let fakeIndexString = String(fakeIndex);
                        if (fakeIndex === 0) {
                            identicalThings[i][0].name = identicalThings[i][0].name + (++fakeIndex);
                        } else {
                            identicalThings[i][0].name = identicalThings[i][0].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                        }
                    }
                    alreadyUsedNames.push(identicalThings[i][0].name);

                    this.gateway.addAggregatedThings(identicalThings[i]);
                }
            } else {
                gateway.addSingleThings(things);
            }
        });
    }
}