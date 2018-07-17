import https = require('https');
import {Configuration} from "./configuration";

/**
 * Contains the relevant information to display the result of a search using the SemanticSearcher component.
 */
export class SearchResult {

    /**
     * Constructor.
     * @param {string} _uri URI of the result.
     * @param {string} _description Short textual description of the result.
     */
    constructor(
        private _uri: string,
        private _description
    ) {
    }

    get uri(): string {
        return this._uri;
    }

    get description(): string {
        return this._description;
    }
}

export class SemanticSearcher {

    /**
     * @param {Configuration} _config Configuration used by the API.
     */
    constructor(private _config: Configuration) {
    }

    /**
     * Make a search using the Google CSE for a property name.
     * The name is first split into keywords then used in the CSE.
     * @param {string} propertyName
     * @return {Promise<any>}
     */
    public makePropertySearch(propertyName: string): Promise<Array<SearchResult>> {
        return new Promise((resolve, reject) => {
            // Split property name into keywords
            let keywords = SemanticSearcher.splitPropertyName(propertyName);
            // Send the keywords to the CSE
            let query = this._config.search.cseBase + "key=" + this._config.search.cseApiKey
                + "&cx=" + this._config.search.cseCx + "&q=" + keywords.join("+");
            // Make request
            https.get(query, (res) => {
                res.setEncoding("utf8");
                let body = "";
                res.on("data", data => {
                    body += data;
                }).on("end", () => {
                    try {
                        let json = JSON.parse(body);
                        let index = 0;
                        let results: Array<SearchResult> = [];
                        // Limit amount of results
                        while (index < json.items.length && results.length < this._config.search.maxSuggestions) {
                            let item = json.items[index];
                            if (SemanticSearcher.isValidResult(item.link)) {
                                results.push(new SearchResult(item.link, item.snippet));
                                index++;
                            }
                        }
                        resolve(results);
                    } catch (e) {
                        reject('Invalid JSON received: ' + e);
                    }
                });
            });
        });
    }

    /**
     * Split a property (variable) name, assuming it is using either the camelCase format or underscore separators.
     * @param {string} propertyName
     * @return {Array<string>}
     */
    private static splitPropertyName(propertyName: string): Array<string>{
        // Split underscore
        let afterSplit = propertyName.split('_');
        let final: Array<string> = [];
        // Split camelCase and put all in lowercase
        for (let i = 0; i < afterSplit.length; i++) {
            final = final.concat(afterSplit[i].split(/(?=[A-Z])/).map(s => s.toLowerCase()));
        }
        return final;
    }

    /**
     * Check the validity of a CSE result. Some result may not be SemanticTypes but other web pages.
     * @param {string} link
     * @return {boolean}
     */
    private static isValidResult(link: string): boolean {
        // Check that the result starts with the right URL and has no file extension or sub directories at the end.
        return /^((?:https:\/\/schema\.org\/)|(?:http:\/\/schema\.big-iot\.org\/mobility\/)|(?:http:\/\/schema\.big-iot\.org\/environment\/))[a-z A-Z]+$/.test(link);
    }

}