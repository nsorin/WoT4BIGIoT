import {Thing, parseTD} from "../thingweb.node-wot/packages/td-tools";
import {ThingAnalyzer} from "./thing-analyzer";
import {Gateway} from "./gateway";
import {OfferingManager} from "./offering-manager";
import {OfferingConverter} from "./offering-converter";
import {Configuration, OfferingToThing} from "./configuration";
import {SearchResult, SemanticSearcher} from "./semantic-searcher";

export class Api {

    private static CONFIG_SOURCE = "../config.json";

    private config: Configuration;
    private thingAnalyzer: ThingAnalyzer;
    private offeringManager: OfferingManager;
    private gateway: Gateway;
    private offeringConverter: OfferingConverter;
    private semanticSearcher: SemanticSearcher;

    /**
     * Used to store names/URIs that are already in use for offerings in this session.
     * @type {any[]}
     */
    private alreadyUsedOfferingNames: Array<string> = [];

    private initComplete = false;

    /**
     * Default constructor. Private to avoid having a uninitialized api.
     */
    private constructor() {
        // Nothing to do, call init
    }

    /**
     * Static method to call to init the API.
     * @return {Promise<any>}
     */
    public static getApi(configSource?: string): Promise<any> {
        let api = new Api();
        return api.init(configSource);
    }

    /**
     * Initialize the API. Must be called before using the API methods.
     * @return {Promise<any>}
     */
    private init(configSource?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            Configuration.getConfiguration(configSource ? configSource : Api.CONFIG_SOURCE).then((config) => {
                this.config = config;
                this.thingAnalyzer = new ThingAnalyzer(this.config);
                this.semanticSearcher = new SemanticSearcher(this.config);
                this.offeringConverter = new OfferingConverter(this.config);
                this.offeringManager = new OfferingManager(this.config);
                this.offeringConverter.init().then(() => {
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
                }).catch((err) => {
                    console.log('OfferingConverter failed to init, error:', err);
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
                    thing = this.thingAnalyzer.resolveContexts(thing, ThingAnalyzer.findPrefixes(thing));
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

    /**
     * Get the list of all offerings waiting to be registered.
     * @return {Array<any>}
     */
    public getOfferingsToRegister() {
        return this.offeringManager.getOfferingsToRegister();
    }

    /**
     * Get the list of all offerings already registered on the marketplace for this session.
     * @return {Array<any>}
     */
    public getRegisteredOfferings() {
        return this.offeringManager.getRegisteredOfferings();
    }

    /**
     * Register all offerings currently waiting to be registered.
     * @return {Promise<any>}
     */
    public registerAllOfferings() {
        return this.offeringManager.registerOfferings();
    }

    /**
     * Delete all registered offerings from the marketplace.
     */
    public deleteAllOfferings() {
        return this.offeringManager.unregisterOfferings(() => {
            console.log('Deleted all offerings!');
        });
    }

    /**
     * Convert offerings to the TD format
     * @param {Array<string>} offeringIds Unique identifiers for offerings on the marketplace.
     * @return {Promise<any>}
     */
    public convertOfferings(offeringIds: Array<string>): Promise<Array<Thing>> {
        return new Promise((resolve, reject) => {
            if (!this.initComplete) {
                reject('Configuration not initialized!');
            } else {
                switch (this.config.offeringConversionStrategy) {
                    case OfferingToThing.OFFERING_TO_THING:
                        let promises: Array<Promise<any>> = [];
                        for (let i = 0; i < offeringIds.length; i++) {
                            promises.push(this.offeringConverter.convertOne(offeringIds[i]));
                        }
                        Promise.all(promises).then((data) => {
                            console.log('Offerings converted!');
                            resolve(data);
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                    case OfferingToThing.MARKETPLACE_TO_THING:
                        this.offeringConverter.convertMultiple(offeringIds).then((data) => {
                            console.log('Offerings converted!');
                            resolve([data]);
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                    case OfferingToThing.PROVIDER_TO_THING:
                        this.offeringConverter.convertMultipleByProvider(offeringIds).then((data) => {
                            resolve(data);
                            console.log('Offerings converted!');
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                }
            }
        });
    }

    /**
     * Get Semantic type suggestion for a field based on its name.
     * @param {string} name
     * @return {Promise<Array<SearchResult>>}
     */
    public getSemanticTypeSuggestions(name: string): Promise<Array<SearchResult>> {
        return this.semanticSearcher.makePropertySearch(name);
    }

    /**
     * Get the current provider's id.
     * @return {string}
     */
    public getProviderId(): string {
        return this.offeringManager.getProviderId();
    }

    /**
     * Get the current consumer.
     * @return {string}
     */
    public getConsumer(): string {
        return this.offeringConverter.getConsumer();
    }

    /**
     * Directly register things on the marketplace (after checking they are compatible)
     * @param {Array<Thing>} things
     */
    private convertThingsDirectly(things: Array<Thing>): void {
        for (let i = 0; i < things.length; i++) {
            // Rename duplicates
            let fakeIndex = 0;
            while (this.alreadyUsedOfferingNames.indexOf(things[i].name) > -1) {
                let fakeIndexString = String(fakeIndex);
                if (fakeIndex === 0) {
                    things[i].name = things[i].name + (++fakeIndex);
                } else {
                    things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                }
            }
            this.alreadyUsedOfferingNames.push(things[i].name);
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
                for (let i = 0; i < identicalThings.length; i++) {
                    // Rename duplicates
                    let fakeIndex = 0;
                    while (this.alreadyUsedOfferingNames.indexOf(identicalThings[i][0].name) > -1) {
                        let fakeIndexString = String(fakeIndex);
                        if (fakeIndex === 0) {
                            identicalThings[i][0].name = identicalThings[i][0].name + (++fakeIndex);
                        } else {
                            identicalThings[i][0].name = identicalThings[i][0].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                        }
                    }
                    this.alreadyUsedOfferingNames.push(identicalThings[i][0].name);
                    // Once the name is unique, add to the gateway.
                    this.gateway.addAggregatedThings(identicalThings[i]);
                }
            } else {
                for (let i = 0; i < things.length; i++) {
                    // Rename duplicates
                    let fakeIndex = 0;
                    while (this.alreadyUsedOfferingNames.indexOf(things[i].name) > -1) {
                        let fakeIndexString = String(fakeIndex);
                        if (fakeIndex === 0) {
                            things[i].name = things[i].name + (++fakeIndex);
                        } else {
                            things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                        }
                    }
                    this.alreadyUsedOfferingNames.push(things[i].name);
                }
                gateway.addSingleThings(things);
            }
        });
    }
}