import {Configuration} from "./configuration";
import {GatewayRoute} from "./gateway-route";
import dateTime = require('node-datetime');
import fs = require('fs');
import path = require('path');
import readline = require('readline');

/**
 * Used to store values over time instead of returning live data from a GatewayRoute.
 */
export class HistoryStore {

    private _memoryStore = [];
    private readonly _fileStream: fs.WriteStream;

    public static readonly DATE_FIELD_NAME = 'date';
    public static readonly VALUES_FIELD_NAME = 'values';

    private static readonly STORES_PATH = path.resolve(__dirname, '../stores');
    private static readonly STORES_EXTENSION = '.store';
    private static readonly START_FIELD = {name: "startTime", rdfUri: "http://schema.big-iot.org/mobility/startTime"};
    private static readonly END_FIELD = {name: "endTime", rdfUri: "http://schema.big-iot.org/mobility/endTime"};
    private static readonly DATE_FIELD = {name: HistoryStore.DATE_FIELD_NAME, rdfUri: "http://schema.big-iot.org/common/measurementTime"};

    /**
     * Constructor. Create a new store based on a GatewayRoute.
     * @param {Configuration} _config Configuration used by the API.
     * @param {GatewayRoute} _source GatewayRoute used to get values.
     */
    constructor(
        private _config: Configuration,
        private _source: GatewayRoute
    ) {
        this._fileStream = fs.createWriteStream(path.resolve(HistoryStore.STORES_PATH, this._source.uri + HistoryStore.STORES_EXTENSION), {flags: 'a'});

        this._source.convertedInputSchema.push(HistoryStore.START_FIELD);
        this._source.convertedInputSchema.push(HistoryStore.END_FIELD);
        this._source.convertedOutputSchema.push(HistoryStore.DATE_FIELD);

        if (this._config.history.onDisk) {
            setInterval(() => {
                this.callSource((result) => this.writeStoreOnDisk(result));
            }, this._config.history.period);
        } else {
            setInterval(() => {
                this.callSource((result) => this.writeStore(result));
            }, this._config.history.period);
        }
    }

    /**
     * Read the currently stored values, with optional temporal filters.
     * @param startTime
     * @param endTime
     * @return {Promise<any>}
     */
    public readStore(startTime?, endTime?): Promise<any> {
        return this._config.history.onDisk ? this.readOnDisk(startTime, endTime) : this.read(startTime, endTime);
    }

    get source(): GatewayRoute {
        return this._source;
    }

    /**
     * Read a store in memory.
     * @param startTime
     * @param endTime
     * @return {Promise<any>}
     */
    private read(startTime?, endTime?) {
        return new Promise((resolve, reject) => {
            // Deep copy of the array to keep the state at the time the function is called
            //TODO Remove this hack
            let returnValue = JSON.parse(JSON.stringify(this._memoryStore));
            if (startTime) {
                // Remove values before start time
                let initialLength = returnValue.length;
                let i;
                for (i = 0; i < returnValue.length; i++) {
                    // First time the date is more than requested start, remove everything before
                    if (returnValue[i].date >= startTime) {
                        returnValue = returnValue.slice(i, returnValue.length);
                        break;
                    }
                }
                if (i === initialLength) {
                    resolve([]);
                }
            }
            if (endTime) {
                // Remove values after start time
                for (let i = 0; i < returnValue.length; i++) {
                    // First time the date is more than requested start, remove everything before
                    if (returnValue[i].date > endTime) {
                        resolve(returnValue.slice(0, i));
                    }
                }
            }
            resolve(returnValue);
        });
    }

    /**
     * Read a store in a file.
     * @param startTime
     * @param endTime
     * @return {Promise<any>}
     */
    private readOnDisk(startTime?, endTime?) {
        return new Promise((resolve, reject) => {
            let reader = readline.createInterface({input: fs.createReadStream(this._fileStream.path)});
            let result = [];
            reader.on('line', (line) => {
                try {
                    let lineObject = JSON.parse(line);
                    if ((!startTime || startTime <= lineObject.date) && (!endTime || endTime >= lineObject.date)) {
                        result.push(lineObject);
                    }
                } catch (e) {
                    console.log('Could not parse line of store:', line);
                }
            }).on('close', (line) => {
                resolve(result);
            });
        });
    }

    /**
     * Call the Gateway route to get new data.
     * @param callback
     */
    private callSource(callback) {
        let newObject = {[HistoryStore.DATE_FIELD_NAME]: dateTime.create().format('Y-m-dTH:M:S')};
        this._source.access({}).then((data) => {
            if (data.length === 1) {
                Object.assign(newObject, data[0]);
            } else {
                newObject[HistoryStore.VALUES_FIELD_NAME] = data;
            }
            callback(newObject);
        });
    }

    /**
     * Write new data on the store (in memory).
     * @param newObject
     */
    private writeStore(newObject) {
        this._memoryStore.push(newObject);
        if (this._memoryStore.length > this._config.history.limit) {
            this._memoryStore.shift();
        }
    }

    /**
     * Write new data on the store (in a file).
     * @param newObject
     */
    private writeStoreOnDisk(newObject) {
        this._fileStream.write(JSON.stringify(newObject) + '\n');
    }

}