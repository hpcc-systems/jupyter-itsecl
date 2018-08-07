class $TS {
    static holdAsync() {
        global.$$async$$ = true;
    }

    static unholdAsync() {
        global.$$async$$ = false;
    }

    static retrieve(result?: any) {
        global.$$done$$(result);
    }

    static put(mimeType: string, obj: string) {
        let result = {};
        result[mimeType] = obj;
        global.$$.done({
            mime: result
        });
    }

    static html(html: string) {
        $TS.put("text/html", html);
    }

    static svg(xml: string) {
        $TS.put("image/svg+xml", xml);
    }

    static png(base64: string) {
        $TS.put("image/png", base64);
    }

    static pngFile(path: string) {
        let base64 = require("fs").readFileSync(path).toString("base64");
        $TS.png(base64);
    }

    static jpg(base64: string) {
        $TS.put("image/jpeg", base64);
    }

    static jpgFile(path: string) {
        let base64 = require("fs").readFileSync(path).toString("base64");
        $TS.jpg(base64);
    }

    static log(text: string) {
        $TS.put("text/plain", text);
    }

    static throw(error: Error) {
        global.$$.sendError(error);
    }
}