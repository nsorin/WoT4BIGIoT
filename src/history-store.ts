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
    private _fileStream: fs.WriteStream;
    private _fileLineCount = 0;

    public static readonly DATE_FIELD_NAME = 'date';
    public static readonly VALUES_FIELD_NAME = 'values';

    private static readonly STORES_PATH = path.resolve(__dirname, '../stores');
    private static readonly STORES_EXTENSION = '.store';
    private static readonly OLD_EXTENSION = '.old';
    private static readonly START_FIELD = {name: "startTime", rdfUri: "http://schema.big-iot.org/mobility/startTime"};
    private static readonly END_FIELD = {name: "endTime", rdfUri: "http://schema.big-iot.org/mobility/endTime"};
    private static readonly DATE_FIELD = {
        name: HistoryStore.DATE_FIELD_NAME,
        rdfUri: "http://schema.big-iot.org/common/measurementTime"
    };

    /**
     * Constructor. Create a new store based on a GatewayRoute.
     * @param {Configuration} _config Configuration used by the API.
     * @param {GatewayRoute} _source GatewayRoute used to get values.
     */
    constructor(
        private _config: Configuration,
        private _source: GatewayRoute
    ) {
        this._source.convertedInputSchema.push(HistoryStore.START_FIELD);
        this._source.convertedInputSchema.push(HistoryStore.END_FIELD);
        this._source.convertedOutputSchema.push(HistoryStore.DATE_FIELD);

        if (this._config.history.onDisk) {
            let filePath = path.resolve(HistoryStore.STORES_PATH, this._source.uri + HistoryStore.STORES_EXTENSION);

            // Get old data if allowed and if it exists
            if (this._config.history.useOldValues && fs.existsSync(filePath)) {
                // Read .store file
                let content = fs.readFileSync(filePath).toString().split("\n");
                // Remove last (empty) line
                content.pop();
                // If there are enough values in the .store file, use as many as needed and discard the rest
                if (content.length >= this._config.history.limit) {
                    let newContent = content.slice(content.length - this._config.history.limit);
                    let dataStr = '';
                    for (let i = 0; i < newContent.length; i++) {
                        dataStr += newContent[i] + (i <= newContent.length - 1 ? '\n' : '');
                    }
                    // Write the values kept in the store
                    fs.writeFileSync(filePath, dataStr);
                    // Set line count to the amount of values retrieved
                    this._fileLineCount = newContent.length;
                // If not, look for additional values in the .store.old file (if it exists)
                } else if (fs.existsSync(filePath + HistoryStore.OLD_EXTENSION)) {
                    let oldContent = fs.readFileSync(filePath + HistoryStore.OLD_EXTENSION).toString().split('\n');
                    // Remove last (empty) line
                    oldContent.pop();
                    // Get only the values we need
                    let newContent = oldContent.slice(Math.max(oldContent.length - (this._config.history.limit - content.length), 0));
                    let dataStr = '';
                    for (let i = 0; i < newContent.length; i++) {
                        dataStr += newContent[i] + '\n';
                    }
                    for (let i = 0; i < content.length; i++) {
                        dataStr += content[i] + (i <= content.length - 1 ? '\n' : '');
                    }
                    // Write the values kept in the store
                    fs.writeFileSync(filePath, dataStr);
                    // Remove the old store
                    fs.unlinkSync(filePath + HistoryStore.OLD_EXTENSION);
                    // Set line count to the amount of values retrieved
                    this._fileLineCount = content.length + newContent.length;
                }
            }

            this._fileStream = fs.createWriteStream(filePath, {flags: 'a'});

            setInterval(() => {
                this.callSource((result) => {
                    try {
                        this.writeStoreOnDisk(result);
                    } catch (err) {
                        console.log('WRITE ERROR:', err);
                    }
                });
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
    private readOnDisk(startTime?: string, endTime?: string): Promise<Array<any>> {
        let result = [];
        // If there is an old file, read from it first
        if (fs.existsSync(this._fileStream.path + HistoryStore.OLD_EXTENSION)) {
            return this.readLinesOnDisk(this._fileStream.path + HistoryStore.OLD_EXTENSION, result, this._fileLineCount, startTime, endTime).then((res) => {
                // Then read current file
                return this.readLinesOnDisk(this._fileStream.path.toString(), res, -1, startTime, endTime);
            });
        } else {
            // Read current file
            return this.readLinesOnDisk(this._fileStream.path.toString(), result, -1, startTime, endTime);
        }
    }

    /**
     * Read lines in a file using a fiven path, and append them to a result array.
     * @param {string} filePath
     * @param {Array<any>} result
     * @param {number} startAt
     * @param {string} startTime
     * @param {string} endTime
     * @return {Promise<Array<any>>}
     */
    private readLinesOnDisk(filePath: string, result: Array<any>, startAt: number = -1, startTime?: string, endTime?: string): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let reader = readline.createInterface({input: fs.createReadStream(filePath)});
            // Count lines read to startAt the right one
            let counter = 0;
            reader.on('line', (line) => {
                if (counter >= startAt) {
                    try {
                        let lineObject = JSON.parse(line);
                        if ((!startTime || startTime <= lineObject.date) && (!endTime || endTime >= lineObject.date)) {
                            result.push(lineObject);
                        }
                    } catch (e) {
                        console.log('Could not parse line of store:', line);
                    }
                }
                counter++;
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
        // If store file is full (reached limit)
        if (this._fileLineCount >= this._config.history.limit) {
            let storeName = this._fileStream.path;
            this._fileStream.close();
            // Remove previous "old" file since it is no longer needed
            if (fs.existsSync(storeName + HistoryStore.OLD_EXTENSION)) {
                fs.unlinkSync(storeName + HistoryStore.OLD_EXTENSION);
            }
            fs.rename(storeName, storeName + HistoryStore.OLD_EXTENSION, (err) => {
                if (err) throw err;
                // Create a new store file
                this._fileStream = fs.createWriteStream(storeName, {flags: 'a'});
                this._fileStream.write(JSON.stringify(newObject) + '\n');
                // Reset counter
                this._fileLineCount = 1;
            });
        } else {
            this._fileStream.write(JSON.stringify(newObject) + '\n');
            this._fileLineCount++;
        }
    }

}