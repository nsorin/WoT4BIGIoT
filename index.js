const http = require('http');
const Api = require('./dist/api');
const td = require('./thingweb.node-wot/packages/td-tools');

let things = [];

http.get("http://localhost:8080/MySensor", (res) => {
    res.setEncoding("utf8");
    let body = "";
    res.on("data", data => {
        body += data;
    }).on("end", () => {
        things.push(body);
        http.get("http://localhost:8082/MySensor", (res2) => {
            res2.setEncoding("utf8");
            let body2 = "";
            res2.on("data", data2 => {
                body2 += data2;
            }).on("end", () => {
                things.push(body2);
                http.get("http://localhost:8084/MySensor", (res3) => {
                    res3.setEncoding("utf8");
                    let body3 = "";
                    res3.on("data", data3 => {
                        body3 += data3;
                    }).on("end", () => {
                        things.push(body3);
                        let a = new Api();
                        a.init().then((api) => {
                            api.registerThings(things);
                        });
                    });
                });
            });
        });
    });
});