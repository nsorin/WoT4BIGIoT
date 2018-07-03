import {Thing} from "../thingweb.node-wot/packages/td-tools";

/**
 * Class containing static constants and methods used to manage semantic metadata in converted Things.
 */
export class MetadataManager {

    // Semantic types
    public static readonly DEFAULT_DATA_TYPE = "https://schema.org/DataType";
    public static readonly DATA_TYPE_CONVERSION = {
        string: "https://schema.org/Text",
        boolean: "https://schema.org/Boolean",
        number: "https://schema.org/Number",
        integer: "https://schema.org/Integer",
        float: "https://schema.org/Float",
        array: "https://schema.org/ItemList",
        undefined: "https://schema.org/DataType"
    };
    public static readonly DEFAULT_ARRAY_TYPE = "https://schema.org/ItemList";

    public static readonly OFFERING_TYPE = "http://schema.big-iot.org/core/Offering";
    public static readonly PROVIDER_TYPE = "http://schema.big-iot.org/core/Provider";


    // BIGIOT Default Metadata
    public static readonly CATEGORY = 'https://schema.org/category';
    public static readonly LICENSE = 'https://schema.org/license';

    // Price properties. Used when reading the thing only! The big iot lib does not use full uris.
    public static readonly PRICE = 'https://schema.org/priceSpecification';
    public static readonly PRICING_MODEL = 'http://schema.big-iot.org/core/pricingModel';
    public static readonly CURRENCY = 'https://schema.org/currency';
    public static readonly MONEY = 'money';
    public static readonly AMOUNT = 'https://schema.org/amount';
    public static readonly ACCESS_INTERFACE_TYPE = 'http://schema.big-iot.org/core/accessInterfaceType';

    // Spatial extent properties
    public static readonly SPATIAL_EXTENT = 'https://schema.org/spatialCoverage';
    public static readonly CITY = 'https://schema.org/address';
    public static readonly BOUNDARY = 'boundary';
    public static readonly LAT_LONG_1 = 'l1';
    public static readonly LAT_LONG_2 = 'l2';
    public static readonly B_LATITUDE = 'lat';
    public static readonly B_LONGITUDE = 'lng';

    public static readonly PROPOSED_PREFIX = 'proposed:';
    public static readonly BIGIOT_URN_PREFIX = 'urn:big-iot:';

    // Other possible Metadata
    public static readonly LATITUDE = 'https://schema.org/latitude';
    public static readonly LONGITUDE = 'https://schema.org/longitude';

    public static readonly LICENSES = [
        'OPEN_DATA_LICENSE',
        'CREATIVE_COMMONS',
        'NON_COMMERCIAL_DATA_LICENSE',
        'PROJECT_INTERNAL_USE_ONLY'
    ];

    public static readonly PRICING_MODELS = [
        'FREE',
        'PER_ACCESS',
        'PER_MESSAGE',
        'PER_MONTH',
        'PER_BYTE'
    ];

    public static readonly FREE = 'FREE';

    public static readonly CURRENCIES = [
        'EUR',
        'USD'
    ];

    // Default values
    public static readonly DEFAULT_CATEGORY = 'urn:big-iot:allOfferingsCategory';

    public static readonly DEFAULT_LICENSE = 'CREATIVE_COMMONS';

    public static readonly DEFAULT_BOUNDARY = {
        [MetadataManager.LAT_LONG_1]: {
            [MetadataManager.B_LATITUDE]: 90,
            [MetadataManager.B_LONGITUDE]: 180
        },
        [MetadataManager.LAT_LONG_2]: {
            [MetadataManager.B_LATITUDE]: -90,
            [MetadataManager.B_LONGITUDE]: -180
        }
    };

    public static readonly DEFAULT_EXTENT = {city: '', boundary: MetadataManager.DEFAULT_BOUNDARY};

    public static readonly DEFAULT_CURRENCY = 'EUR';
    public static readonly DEFAULT_AMOUNT = 0;

    // --- Public metadata guessers

    /**
     * Guess an offering's category based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @param interaction
     * @return {string}
     */
    public static guessCategory(thing: Thing, interaction: any): string {
        if (interaction.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(interaction[MetadataManager.CATEGORY]);
        }
        if (thing.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(thing[MetadataManager.CATEGORY]);
        }
        return MetadataManager.DEFAULT_CATEGORY;
    }

    /**
     * Guess an offering's merged category based on the semantic metadata contained in the TD.
     * @param thing
     * @return {string}
     */
    public static guessMergedCategory(thing): string {
        if (thing.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(thing[MetadataManager.CATEGORY]);
        }
        return MetadataManager.DEFAULT_CATEGORY;
    }

    /**
     * Guess an offering's aggregated category based on the semantic metadata contained in the TD.
     * @param {Array<Thing>} things
     * @param {Array<string>} propertyIndexes
     * @param {string} actionIndex
     * @return {string}
     */
    public static guessAggregatedCategory(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string): string {
        let category = '';
        for (let i = 0; i < things.length; i++) {
            let newCategory = propertyIndexes.length > 0 ? MetadataManager.guessMergedCategory(things[i]) :
                (actionIndex ? MetadataManager.guessCategory(things[i], things[i].actions[actionIndex]) :
                    MetadataManager.guessCategory(things[i], things[i].properties[propertyIndexes[0]]));
            if (i === 0) {
                category = newCategory;
            } else if (category !== newCategory) {
                return MetadataManager.DEFAULT_CATEGORY;
            }
        }
        return category === '' ? MetadataManager.DEFAULT_CATEGORY : category;
    }

    /**
     * Guess an offering's license based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @param interaction
     * @return {string}
     */
    public static guessLicense(thing: Thing, interaction: any): string {
        if (MetadataManager.isLicenseValid(interaction[MetadataManager.LICENSE])) {
            return interaction[MetadataManager.LICENSE];
        }
        if (MetadataManager.isLicenseValid(thing[MetadataManager.LICENSE])) {
            return thing[MetadataManager.LICENSE];
        }
        return MetadataManager.DEFAULT_LICENSE;
    }

    /**
     * Guess an offering's merged license based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @return {any}
     */
    public static guessMergedLicense(thing: Thing): string {
        let licenseIndex = -1;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                licenseIndex = Math.max(licenseIndex, MetadataManager.LICENSES.indexOf(thing.properties[i][MetadataManager.LICENSE]));
            }
        }
        return licenseIndex > -1 ? MetadataManager.LICENSES[licenseIndex] : MetadataManager.DEFAULT_LICENSE;
    }

    /**
     * Guess an offering's aggregated license based on the semantic metadata contained in the TD.
     * @param {Array<Thing>} things
     * @param {Array<string>} propertyIndexes
     * @param {string} actionIndex
     * @return {string}
     */
    public static guessAggregatedLicense(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string): string {
        let licenseIndex = -1;
        for (let i = 0; i < things.length; i++) {
            let newLicense = propertyIndexes.length > 1 ?
                this.guessMergedLicense(things[i]) : (actionIndex ?
                    this.guessLicense(things[i], things[i].actions[actionIndex]) :
                    this.guessLicense(things[i], things[i].properties[propertyIndexes[0]]));
            licenseIndex = Math.max(licenseIndex, MetadataManager.LICENSES.indexOf(newLicense));
        }
        return licenseIndex >= 0 ? MetadataManager.LICENSES[licenseIndex] : MetadataManager.DEFAULT_LICENSE;
    }

    /**
     * Guess an offering's price based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @param interaction
     * @return {any} Price in the bigiot-js api format (no full URIs)
     */
    public static guessPrice(thing: Thing, interaction: any): any {
        if (MetadataManager.isPriceValid(interaction[MetadataManager.PRICE])) {
            // Return a copy of the value
            return MetadataManager.copyPrice(interaction[MetadataManager.PRICE]);
        }
        if (MetadataManager.isPriceValid(thing[MetadataManager.PRICE])) {
            // Return a copy of the value
            return MetadataManager.copyPrice(thing[MetadataManager.PRICE]);
        }
        return {pricingModel: MetadataManager.FREE};
    }

    /**
     * Guess an offering's merged price based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @return {any} Price in the bigiot-js api format (no full URIs)
     */
    public static guessMergedPrice(thing: Thing): any {
        let price: any = {pricingModel: MetadataManager.FREE};
        let count = 0;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                price = MetadataManager.isPriceValid(thing.properties[i][MetadataManager.PRICE]) ?
                    MetadataManager.sumPrices(price, MetadataManager.copyPrice(thing.properties[i][MetadataManager.PRICE]))
                    : price;
                // If a null price is returned, there was an incompatibility
                if (price === null) {
                    break;
                }
                count++;
            }
        }
        if (price && price.pricingModel === 'PER_BYTE') {
            price.money.amount /= count;
        }
        if (price) {
            return price;
        }
        if (MetadataManager.isPriceValid(thing[MetadataManager.PRICE])) {
            return MetadataManager.copyPrice(thing[MetadataManager.PRICE]);
        }
        return {pricingModel: MetadataManager.FREE};
    }

    /**
     * Guess an offering's aggregated price based on the semantic metadata contained in the TD.
     * @param {Array<Thing>} things
     * @param {Array<string>} propertyIndexes
     * @param {string} actionIndex
     * @return {any} Price in the bigiot-js api format (no full URIs)
     */
    public static guessAggregatedPrice(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string): any {
        let prices = [];
        for (let i = 0; i < things.length; i++) {
            prices.push(propertyIndexes.length > 1 ? MetadataManager.guessMergedPrice(things[i])
                : (actionIndex ? MetadataManager.guessPrice(things[i], things[i].actions[actionIndex]) :
                    MetadataManager.guessPrice(things[i], things[i].properties[propertyIndexes[0]])));
        }
        return MetadataManager.averagePrice(prices);
    }

    /**
     * Guess an offering's spatial extent based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @param interaction
     * @return {any} SpatialExtent in the bigiot-js api format (no full URIs)
     */
    public static guessSpatialExtent(thing: Thing, interaction: any): any {
        if (MetadataManager.isSpatialExtentValid(interaction[MetadataManager.SPATIAL_EXTENT])) {
            return MetadataManager.copySpatialExtent(interaction[MetadataManager.SPATIAL_EXTENT]);
        }
        if (MetadataManager.isSpatialExtentValid(thing[MetadataManager.SPATIAL_EXTENT])) {
            return MetadataManager.copySpatialExtent(thing[MetadataManager.SPATIAL_EXTENT]);
        }
        // Attempt to find metadata in a format other than the usual BIG IoT model format
        let other = MetadataManager.guessSpatialExtentFromOtherFormats(interaction);
        other = other ? other : MetadataManager.guessSpatialExtentFromOtherFormats(thing);
        return other ? other : {
            city: MetadataManager.DEFAULT_EXTENT.city,
            boundary: {
                l1: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l1.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l1.lng
                },
                l2: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l2.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l2.lng
                }
            }
        };
    }

    /**
     * Guess an offering's merged spatial extent based on the semantic metadata contained in the TD.
     * @param {Thing} thing
     * @return {any} SpatialExtent in the bigiot-js api format (no full URIs)
     */
    public static guessMergedSpatialExtent(thing: Thing): any {
        let boundary: any = null;
        let city: string = '';
        let cityOk = true;
        let firstSet: boolean = false;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                let extent = thing.properties[i][MetadataManager.SPATIAL_EXTENT];
                // Check TD's spatial extent. If invalid, it cannot be used and the merge stops
                let newExtent;
                if (!MetadataManager.isSpatialExtentValid(extent)) {
                    newExtent = MetadataManager.guessSpatialExtentFromOtherFormats(thing.properties[i]);
                    if (!newExtent) break;
                } else {
                    // Copy TD extent
                    newExtent = MetadataManager.copySpatialExtent(extent);
                }
                if (city === '') {
                    city = cityOk ? newExtent.city : city;
                } else if (city !== newExtent.city) {
                    cityOk = false;
                }
                if (firstSet && boundary) {
                    boundary = MetadataManager.mergeBoundaries(boundary, newExtent.boundary);
                } else {
                    boundary = newExtent.boundary;
                    firstSet = true;
                }
            }
        }
        if (boundary || city) {
            return {
                city: city,
                boundary: boundary
            };
        }
        if (MetadataManager.isSpatialExtentValid(thing[MetadataManager.SPATIAL_EXTENT])) {
            return MetadataManager.copySpatialExtent(thing[MetadataManager.SPATIAL_EXTENT]);
        }
        let other = MetadataManager.guessSpatialExtentFromOtherFormats(thing);
        if (other) {
            return other;
        }
        return {
            city: MetadataManager.DEFAULT_EXTENT.city,
            boundary: {
                l1: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l1.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l1.lng
                },
                l2: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l2.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l2.lng
                }
            }
        };
    }

    /**
     * Guess an offering's aggregated spatial extent based on the semantic metadata contained in the TD.
     * @param {Array<Thing>} things
     * @param {Array<string>} propertyIndexes
     * @param {string} actionIndex
     * @return {any} SpatialExtent in the bigiot-js api format (no full URIs)
     */
    public static guessAggregatedSpatialExtent(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string): any {
        let boundary: any = null;
        let city: string = '';
        let cityOk = true;
        let firstSet: boolean = false;
        for (let i = 0; i < things.length; i++) {
            let extent = propertyIndexes.length > 1 ? MetadataManager.guessMergedSpatialExtent(things[i])
                : (actionIndex ? MetadataManager.guessSpatialExtent(things[i], things[i].actions[actionIndex]) :
                    MetadataManager.guessSpatialExtent(things[i], things[i].properties[propertyIndexes[0]]));
            if (city === '') {
                city = cityOk ? extent.city : city;
            } else if (city !== extent.city) {
                cityOk = false;
            }
            if (firstSet && boundary) {
                boundary = MetadataManager.mergeBoundaries(boundary, extent.boundary);
            } else {
                boundary = extent.boundary;
                firstSet = true;
            }
        }
        return boundary || city ? {
            city: city,
            boundary: boundary
        } : {
            city: MetadataManager.DEFAULT_EXTENT.city,
            boundary: {
                l1: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l1.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l1.lng
                },
                l2: {
                    lat: MetadataManager.DEFAULT_EXTENT.boundary.l2.lat,
                    lng: MetadataManager.DEFAULT_EXTENT.boundary.l2.lng
                }
            }
        };
    }

    // --- Private merging tools

    /**
     * Merge two boundaries to create a new one which contains both. Takes and returns the bigiot-js format.
     * @param b1
     * @param b2
     * @return {any}
     */
    private static mergeBoundaries(b1: any, b2: any): any {
        return {
            l1: {
                lat: Math.min(
                    b1.l1.lat,
                    b1.l2.lat,
                    b2.l1.lat,
                    b2.l2.lat
                ),
                lng: Math.min(
                    b1.l1.lng,
                    b1.l2.lng,
                    b2.l1.lng,
                    b2.l2.lng
                )
            },
            l2: {
                lat: Math.max(
                    b1.l1.lat,
                    b1.l2.lat,
                    b2.l1.lat,
                    b2.l2.lat
                ),
                lng: Math.max(
                    b1.l1.lng,
                    b1.l2.lng,
                    b2.l1.lng,
                    b2.l2.lng
                )
            },
        };

    }

    /**
     * Returns the average value of a list of prices. Takes and returns the bigiot-js format.
     * @param prices
     * @return {any}
     */
    private static averagePrice(prices: any) {
        let price: any = {pricingModel: MetadataManager.FREE};
        let count = 0;
        for (let i = 0; i < prices.length; i++) {
            price = prices[i] ? MetadataManager.sumPrices(price, prices[i]) : price;
            // If a null price is returned, there was an incompatibility
            if (price === null) {
                break;
            }
            count++;
        }
        if (price && price.money && !isNaN(price.money.amount)) {
            price.money.amount /= count;
        } else {
            price = {pricingModel: MetadataManager.FREE};
        }
        return price;
    }

    /**
     * Returns the sum of a list of prices. Takes and returns the bigiot-js format.
     * @param p1
     * @param p2
     * @return {any}
     */
    private static sumPrices(p1: any, p2: any) {
        // An invalid price becomes default
        p1 = p1 ? p1 : {pricingModel: MetadataManager.FREE};
        p2 = p2 ? p2 : {pricingModel: MetadataManager.FREE};
        // If one of the two is free, return the other
        if (p1.pricingModel === MetadataManager.FREE) {
            return p2;
        }
        if (p2.pricingModel === MetadataManager.FREE) {
            return p1;
        }
        // If there is an incompatibility, return null (error)
        if (p1.pricingModel !== p2.pricingModel) {
            return null;
        }
        // Sum compatible prices
        return {
            pricingModel: p1.pricingModel,
            money: {
                amount: p1.money.amount + p2.money.amount,
                currency: p1.money.currency
            }
        };
    }

    // --- Private copy methods
    /**
     * Creates and returns a price in the bigiot-js lib format from a price using the semantic format (with full URIs)
     * @param tdPrice
     * @return {any}
     */
    private static copyPrice(tdPrice: any): any {
        return {
            pricingModel: tdPrice[MetadataManager.PRICING_MODEL],
            money: tdPrice[MetadataManager.MONEY] ? {
                amount: tdPrice[MetadataManager.MONEY][MetadataManager.AMOUNT],
                currency: tdPrice[MetadataManager.MONEY][MetadataManager.CURRENCY]
            } : null
        };
    }

    /**
     * Creates and returns a spatial extent in the bigiot-js lib format from a extent using the semantic format (with full URIs)
     * @param tdExtent
     * @return {any}
     */
    private static copySpatialExtent(tdExtent: any): any {
        return {
            city: tdExtent[MetadataManager.CITY] ? tdExtent[MetadataManager.CITY] : '',
            boundary: tdExtent[MetadataManager.BOUNDARY] ? {
                l1: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_1] ? {
                    lat: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_1][MetadataManager.B_LATITUDE],
                    lng: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_1][MetadataManager.B_LONGITUDE],
                } : null,
                l2: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_2] ? {
                    lat: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_2][MetadataManager.B_LATITUDE],
                    lng: tdExtent[MetadataManager.BOUNDARY][MetadataManager.LAT_LONG_2][MetadataManager.B_LONGITUDE],
                } : null
            } : null
        };
    }

    /**
     * Try to guess the spatial extent for an interaction or thing based on schema.org properties that might be present
     * in the TD (other than the BIG IoT model).
     * @param thingOrInteraction
     * @return {any}
     */
    private static guessSpatialExtentFromOtherFormats(thingOrInteraction: any): any {
        // Check for direct address
        if (thingOrInteraction.hasOwnProperty(MetadataManager.CITY)) {
            return {city: thingOrInteraction[MetadataManager.CITY]};
        }
        // Check for direct lat/long
        if (thingOrInteraction.hasOwnProperty(MetadataManager.LATITUDE)
            && thingOrInteraction.hasOwnProperty(MetadataManager.LATITUDE)) {
            return {
                city: '',
                boundary: {
                    l1: {
                        lat: thingOrInteraction[MetadataManager.LATITUDE],
                        lng: thingOrInteraction[MetadataManager.LONGITUDE]
                    },
                    l2: {
                        lat: thingOrInteraction[MetadataManager.LATITUDE],
                        lng: thingOrInteraction[MetadataManager.LONGITUDE]
                    }
                }
            }
        }
        // TODO: Support other formats
        return null;
    }

    // --- Public validity checkers

    /**
     * Checks the URI scheme of a category. If does not match one of the two big-iot schemes, prepend proposed: to it.
     * @param {string} category
     * @return {string}
     */
    public static makeCategoryValid(category: string): string {
        if (category.startsWith(MetadataManager.BIGIOT_URN_PREFIX) || category.startsWith(MetadataManager.PROPOSED_PREFIX)) {
            return category;
        }
        return MetadataManager.PROPOSED_PREFIX + category;
    }

    /**
     * Check whether a license is among the valid marketplace licenses.
     * @param {string} license
     * @return {boolean}
     */
    public static isLicenseValid(license: string): boolean {
        return license && MetadataManager.LICENSES.indexOf(license) > -1;
    }

    /**
     * Check whether a price is valid in the offering model. Use full URIs.
     * @param price
     * @return {boolean}
     */
    public static isPriceValid(price: any): boolean {
        return price && (price[MetadataManager.PRICING_MODEL]
            && MetadataManager.PRICING_MODELS.indexOf(price[MetadataManager.PRICING_MODEL]) > -1
            && (price[MetadataManager.PRICING_MODEL] === MetadataManager.FREE || (
                price[MetadataManager.MONEY]
                && MetadataManager.CURRENCIES.indexOf(price[MetadataManager.MONEY][MetadataManager.CURRENCY]) > -1
                && !isNaN(price[MetadataManager.MONEY][MetadataManager.AMOUNT])
            )));
    }

    /**
     * Check whether a spatial extent is valid in the offering model. Use full URIs.
     * @param extent
     * @return {boolean}
     */
    public static isSpatialExtentValid(extent: any): boolean {
        return extent && ((extent.hasOwnProperty(MetadataManager.CITY)
            && MetadataManager.isCityValid(extent[MetadataManager.CITY]))
            || (extent.hasOwnProperty(MetadataManager.BOUNDARY)
                && MetadataManager.isBoundaryValid(extent[MetadataManager.BOUNDARY]
                )
            ));
    }

    /**
     * Check whether an address is valid.
     * @param city
     * @return {boolean}
     */
    public static isCityValid(city: any): boolean {
        return city && (typeof city === 'string' && city != '');
    }

    /**
     * Check whether a boundary is valid. Use full URIs.
     * @param boundary
     * @return {boolean}
     */
    public static isBoundaryValid(boundary: any): boolean {
        return boundary && (boundary.hasOwnProperty(MetadataManager.LAT_LONG_1) && boundary.hasOwnProperty(MetadataManager.LAT_LONG_2)
            && MetadataManager.isLatLongValid(boundary[MetadataManager.LAT_LONG_1])
            && MetadataManager.isLatLongValid(boundary[MetadataManager.LAT_LONG_2]));
    }

    /**
     * Check whether a lat/lng pair is valid. Use full URIs.
     * @param l
     * @return {boolean}
     */
    public static isLatLongValid(l: any): boolean {
        return l && !isNaN(l[MetadataManager.B_LATITUDE]) && !isNaN(l[MetadataManager.B_LONGITUDE]);
    }

    // --- Public methods used to ask for metadata

    /**
     * Formats an array to display it as a one-line string.
     * @param arr
     * @return {string}
     */
    public static getFormattedArray(arr) {
        let res = '[';
        for (let i = 0; i < arr.length; i++) {
            res += arr[i] + (i < arr.length - 1 ? ', ' : '');
        }
        return res + ']';
    }
}