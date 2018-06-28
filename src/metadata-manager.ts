import {Thing} from "../thingweb.node-wot/packages/td-tools";

export class MetadataManager {

    // Semantic types
    public static readonly DEFAULT_DATA_TYPE = "http://schema.org/DataType";
    public static readonly DATA_TYPE_CONVERSION = {
        string: "http://schema.org/Text",
        boolean: "http://schema.org/Boolean",
        number: "http://schema.org/Number",
        integer: "http://schema.org/Integer",
        float: "http://schema.org/Float"
    };
    public static readonly DEFAULT_ARRAY_TYPE = "http://schema.org/ItemList";

    public static readonly OFFERING_TYPE = "http://schema.big-iot.org/core/Offering";
    public static readonly PROVIDER_TYPE = "http://schema.big-iot.org/core/Provider";


    // BIGIOT Default Metadata
    public static readonly CATEGORY = 'http://schema.org/category';
    public static readonly LICENSE = 'http://schema.org/license';

    // Price properties
    public static readonly PRICE = 'http://schema.org/priceSpecification';
    public static readonly PRICING_MODEL = 'pricingModel';
    public static readonly CURRENCY = 'currency';
    public static readonly MONEY = 'money';
    public static readonly AMOUNT = 'amount';
    public static readonly ACCESS_INTERFACE_TYPE = 'http://schema.big-iot.org/core/accessInterfaceType';

    // Spatial extent properties
    public static readonly SPATIAL_EXTENT = 'http://schema.org/spatialCoverage';
    public static readonly CITY = 'city';
    public static readonly BOUNDARY = 'boundary';
    public static readonly LAT_LONG_1 = 'l1';
    public static readonly LAT_LONG_2 = 'l2';
    public static readonly B_LATITUDE = 'lat';
    public static readonly B_LONGITUDE = 'lng';

    public static readonly PROPOSED_PREFIX = 'proposed:';
    public static readonly BIGIOT_URN_PREFIX = 'urn:big-iot:';

    // Other possible Metadata
    public static readonly LATITUDE = 'http://schema.org/latitude';
    public static readonly LONGITUDE = 'http://schema.org/longitude';

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
    public static readonly DEFAULT_MONEY = {
        [MetadataManager.CURRENCY]: MetadataManager.DEFAULT_CURRENCY,
        [MetadataManager.AMOUNT]: MetadataManager.DEFAULT_AMOUNT
    };
    public static readonly DEFAULT_PRICE = {
        pricingModel: MetadataManager.FREE
    };

    // --- Public metadata guessers

    public static guessCategory(thing: Thing, interaction: any) {
        if (interaction.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(interaction[MetadataManager.CATEGORY]);
        }
        if (thing.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(thing[MetadataManager.CATEGORY]);
        }
        return MetadataManager.DEFAULT_CATEGORY;
    }

    public static guessMergedCategory(thing) {
        if (thing.hasOwnProperty(MetadataManager.CATEGORY)) {
            return MetadataManager.makeCategoryValid(thing[MetadataManager.CATEGORY]);
        }
        return MetadataManager.DEFAULT_CATEGORY;
    }

    public static guessAggregatedCategory(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string) {
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

    public static guessLicense(thing: Thing, interaction: any) {
        if (MetadataManager.isLicenseValid(interaction[MetadataManager.LICENSE])) {
            return interaction[MetadataManager.LICENSE];
        }
        if (MetadataManager.isLicenseValid(thing[MetadataManager.LICENSE])) {
            return thing[MetadataManager.LICENSE];
        }
        return MetadataManager.DEFAULT_LICENSE;
    }

    public static guessMergedLicense(thing: Thing) {
        let licenseIndex = -1;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                licenseIndex = Math.max(licenseIndex, MetadataManager.LICENSES.indexOf(thing.properties[i][MetadataManager.LICENSE]));
            }
        }
        return licenseIndex > -1 ? MetadataManager.LICENSES[licenseIndex] : MetadataManager.DEFAULT_LICENSE;
    }

    public static guessAggregatedLicense(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string) {
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

    public static guessPrice(thing: Thing, interaction: any) {
        if (MetadataManager.isPriceValid(interaction[MetadataManager.PRICE])) {
            return interaction[MetadataManager.PRICE];
        }
        if (MetadataManager.isPriceValid(thing[MetadataManager.PRICE])) {
            return thing[MetadataManager.PRICE];
        }
        return MetadataManager.DEFAULT_PRICE;
    }

    public static guessMergedPrice(thing: Thing) {
        let price: any = MetadataManager.DEFAULT_PRICE;
        let count = 0;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                price = MetadataManager.sumPrices(price,
                    MetadataManager.isPriceValid(thing.properties[i][MetadataManager.PRICE]) ?
                        thing.properties[i][MetadataManager.PRICE] : MetadataManager.DEFAULT_PRICE);
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
        if (MetadataManager.isPriceValid(price)) {
            return price;
        }
        if (MetadataManager.isPriceValid(thing[MetadataManager.PRICE])) {
            return thing[MetadataManager.PRICE];
        }
        return this.DEFAULT_PRICE;
    }

    public static guessAggregatedPrice(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string) {
        let prices = [];
        for (let i = 0; i < things.length; i++) {
            prices.push(propertyIndexes.length > 1 ? MetadataManager.guessMergedPrice(things[i])
                : (actionIndex ? MetadataManager.guessPrice(things[i], things[i].actions[actionIndex]) :
                    MetadataManager.guessPrice(things[i], things[i].properties[propertyIndexes[0]])));
        }
        return MetadataManager.averagePrice(prices);
    }

    public static guessSpatialExtent(thing: Thing, interaction: any) {
        if (MetadataManager.isSpatialExtentValid(interaction[MetadataManager.SPATIAL_EXTENT])) {
            return interaction[MetadataManager.SPATIAL_EXTENT];
        }
        if (MetadataManager.isSpatialExtentValid(thing[MetadataManager.SPATIAL_EXTENT])) {
            return thing[MetadataManager.SPATIAL_EXTENT];
        }
        return MetadataManager.DEFAULT_EXTENT;
    }

    public static guessMergedSpatialExtent(thing: Thing) {
        let boundary: any = null;
        let city: string = '';
        let cityOk = true;
        let firstSet: boolean = false;
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                let extent = thing.properties[i][MetadataManager.SPATIAL_EXTENT];
                if (!MetadataManager.isSpatialExtentValid(extent)) {
                    break;
                }
                if (city === '') {
                    city = cityOk ? extent[MetadataManager.CITY] : city;
                } else if (city !== extent[MetadataManager.CITY]) {
                    cityOk = false;
                }
                if (firstSet) {
                    boundary = MetadataManager.isSpatialExtentValid(extent) ?
                        MetadataManager.mergeBoundaries(boundary, extent[MetadataManager.BOUNDARY]) : null;
                } else {
                    boundary = MetadataManager.isSpatialExtentValid(extent) ?
                        extent[MetadataManager.BOUNDARY] : null;
                    firstSet = true;
                }
                if (boundary === null) {
                    break;
                }
            }
        }
        return boundary ? {
            city: city,
            boundary: boundary
        } : (MetadataManager.isSpatialExtentValid(thing[MetadataManager.SPATIAL_EXTENT]) ?
            thing[MetadataManager.SPATIAL_EXTENT] : MetadataManager.DEFAULT_EXTENT);
    }

    public static guessAggregatedSpatialExtent(things: Array<Thing>, propertyIndexes: Array<string>, actionIndex?: string) {
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
            if (firstSet) {
                boundary = MetadataManager.isSpatialExtentValid(extent) ?
                    MetadataManager.mergeBoundaries(boundary, extent.boundary) : null;
            } else {
                boundary = MetadataManager.isSpatialExtentValid(extent) ?
                    extent.boundary : null;
                firstSet = true;
            }
            if (boundary === null) {
                break;
            }
        }
        return boundary ? {
            city: city,
            boundary: boundary
        } : MetadataManager.DEFAULT_EXTENT;
    }

    // --- Private merging tools

    private static mergeBoundaries(b1: any, b2: any): any {
        return {
            [MetadataManager.LAT_LONG_1]: {
                [MetadataManager.B_LATITUDE]: Math.min(
                    b1[MetadataManager.LAT_LONG_1][MetadataManager.B_LATITUDE],
                    b1[MetadataManager.LAT_LONG_2][MetadataManager.B_LATITUDE],
                    b2[MetadataManager.LAT_LONG_1][MetadataManager.B_LATITUDE],
                    b2[MetadataManager.LAT_LONG_2][MetadataManager.B_LATITUDE]
                ),
                [MetadataManager.B_LONGITUDE]: Math.min(
                    b1[MetadataManager.LAT_LONG_1][MetadataManager.B_LONGITUDE],
                    b1[MetadataManager.LAT_LONG_2][MetadataManager.B_LONGITUDE],
                    b2[MetadataManager.LAT_LONG_1][MetadataManager.B_LONGITUDE],
                    b2[MetadataManager.LAT_LONG_2][MetadataManager.B_LONGITUDE]
                )
            },
            [MetadataManager.LAT_LONG_2]: {
                [MetadataManager.B_LATITUDE]: Math.max(
                    b1[MetadataManager.LAT_LONG_1][MetadataManager.B_LATITUDE],
                    b1[MetadataManager.LAT_LONG_2][MetadataManager.B_LATITUDE],
                    b2[MetadataManager.LAT_LONG_1][MetadataManager.B_LATITUDE],
                    b2[MetadataManager.LAT_LONG_2][MetadataManager.B_LATITUDE]
                ),
                [MetadataManager.B_LONGITUDE]: Math.max(
                    b1[MetadataManager.LAT_LONG_1][MetadataManager.B_LONGITUDE],
                    b1[MetadataManager.LAT_LONG_2][MetadataManager.B_LONGITUDE],
                    b2[MetadataManager.LAT_LONG_1][MetadataManager.B_LONGITUDE],
                    b2[MetadataManager.LAT_LONG_2][MetadataManager.B_LONGITUDE]
                )
            },
        };

    }

    private static mergePrices(prices: any): any {
        let price: any = MetadataManager.DEFAULT_PRICE;
        let count = 0;
        for (let i = 0; i < prices.length; i++) {
            price = MetadataManager.sumPrices(price, MetadataManager.isPriceValid(prices[i]) ?
                prices[i] : MetadataManager.DEFAULT_PRICE);
            // If a null price is returned, there was an incompatibility
            if (price === null) {
                break;
            }
            count++;
        }
        if (price && price.pricingModel === 'PER_BYTE') {
            price.money.amount /= count;
        }
        return price;
    }

    private static averagePrice(prices: any) {
        let price: any = MetadataManager.DEFAULT_PRICE;
        let count = 0;
        for (let i = 0; i < prices.length; i++) {
            price = MetadataManager.sumPrices(price, MetadataManager.isPriceValid(prices[i]) ?
                prices[i] : MetadataManager.DEFAULT_PRICE);
            // If a null price is returned, there was an incompatibility
            if (price === null) {
                break;
            }
            count++;
        }
        if (price && price.money && !isNaN(price.money.amount)) {
            price.money.amount /= count;
        } else {
            price = MetadataManager.DEFAULT_PRICE;
        }
        return price;
    }

    private static sumPrices(p1: any, p2: any) {
        // An invalid price becomes default
        p1 = MetadataManager.isPriceValid(p1) ? p1 : MetadataManager.DEFAULT_PRICE;
        p2 = MetadataManager.isPriceValid(p2) ? p2 : MetadataManager.DEFAULT_PRICE;
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


    // --- Public validity checkers

    public static makeCategoryValid(category: string): string {
        if (category.startsWith(MetadataManager.BIGIOT_URN_PREFIX) || category.startsWith(MetadataManager.PROPOSED_PREFIX)) {
            return category;
        }
        return MetadataManager.PROPOSED_PREFIX + category;
    }

    public static isLicenseValid(license: string): boolean {
        return license && MetadataManager.LICENSES.indexOf(license) > -1;
    }

    public static isPriceValid(price: any): boolean {
        return price && (price[MetadataManager.PRICING_MODEL]
            && MetadataManager.PRICING_MODELS.indexOf(price[MetadataManager.PRICING_MODEL]) > -1
            && (price[MetadataManager.PRICING_MODEL] === MetadataManager.FREE || (
                price[MetadataManager.MONEY]
                && MetadataManager.CURRENCIES.indexOf(price[MetadataManager.MONEY][MetadataManager.CURRENCY]) > -1
                && !isNaN(price[MetadataManager.MONEY][MetadataManager.AMOUNT])
            )));
    }

    public static isSpatialExtentValid(extent: any): boolean {
        return extent && ((extent.hasOwnProperty(MetadataManager.CITY)
            && MetadataManager.isCityValid(extent[MetadataManager.CITY]))
            || (extent.hasOwnProperty(MetadataManager.BOUNDARY)
                && MetadataManager.isBoundaryValid(extent[MetadataManager.BOUNDARY]
                )
            ));
    }

    public static isCityValid(city: any): boolean {
        return city && (typeof city === 'string' && city != '');
    }

    public static isBoundaryValid(boundary: any): boolean {
        return boundary && (boundary.hasOwnProperty(MetadataManager.LAT_LONG_1) && boundary.hasOwnProperty(MetadataManager.LAT_LONG_2)
            && MetadataManager.isLatLongValid(boundary[MetadataManager.LAT_LONG_1])
            && MetadataManager.isLatLongValid(boundary[MetadataManager.LAT_LONG_2]));
    }

    public static isLatLongValid(l: any): boolean {
        return l && !isNaN(l[MetadataManager.B_LATITUDE]) && !isNaN(l[MetadataManager.B_LONGITUDE]);
    }

    // --- Public methods used to ask for metadata

    public static getFormattedArray(arr) {
        let res = '[';
        for (let i = 0; i < arr.length; i++) {
            res += arr[i] + (i < arr.length - 1 ? ', ' : '');
        }
        return res + ']';
    }
}