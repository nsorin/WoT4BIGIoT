import https = require('https');
import {Configuration} from "./configuration";

export class SearchResult {
    public readonly uri: string;
    public readonly description: string;

    constructor(uri: string, desc: string) {
        this.uri = uri;
        this.description = desc;
    }
}

export class SemanticSearcher {

    private readonly config;

    constructor(config: Configuration) {
        this.config = config;
    }

    public makePropertySearch(propertyName: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let keywords = this.splitPropertyName(propertyName);
            let query = this.config.search.cseBase + "key=" + this.config.search.cseApiKey
                + "&cx=" + this.config.search.cseCx + "&q=" + keywords.join("+");
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
                        while (index < json.items.length && results.length < 10) {
                            let item = json.items[index];
                            if (this.isValidResult(item.link)) {
                                results.push(new SearchResult(item.link, item.snippet));
                            }
                            index++;
                        }
                        resolve(results);
                    } catch (e) {
                        reject('Invalid JSON received: ' + e);
                    }
                });
            });
        });
    }

    private splitPropertyName(propertyName: string) {
        // Split underscore
        let afterSplit = propertyName.split('_');
        let final: Array<string> = [];
        // Split camelCase and put all in lowercase
        for (let i = 0; i < afterSplit.length; i++) {
            final = final.concat(afterSplit[i].split(/(?=[A-Z])/).map(s => s.toLowerCase()));
        }
        return final;
    }

    private isValidResult(link: string): boolean {
        return /^((?:https:\/\/schema\.org\/)|(?:http:\/\/schema\.big-iot\.org\/mobility\/)|(?:http:\/\/schema\.big-iot\.org\/environment\/))[a-z A-Z]+$/.test(link);
    }

}