#!/usr/bin/env node

/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

import fs = require("fs");
import path = require("path");
import * as ts from "typescript";
import { Logger } from "./logging";
import { ECLExecutor } from "./eclkernel";
let Kernel = require("jpecl-kernel");
import vm = require("vm");

interface KernelConfig {
    cwd: string;
    hideUndefined: boolean;
    protocolVersion: string;
    startupCallback: () => void;
    debug: boolean;
    kernelInfoReply: Object;
    startupScript?: string;
    connection?: Object;
    transpile?: (code: string) => string;
    eclExecutor: any;
}

class Configuration {
    private _onDebug: boolean = false;
    private _workingDir: string = process.cwd();
    private hideUndefined: boolean = false;
    private protocolVer: string = "5.0";
    private onStartup: () => void = function () {
        let tscode = fs.readFileSync(path.join(__dirname, "startup.ts")).toString();
        let code = ts.transpile(tscode, {});
        this.session.execute(code, {
            onSuccess: function () {
                Logger.log("startupCallback: \"startup.ts\" run successfuly");
            },
            onError: function () {
                Logger.log("startupCallback: \"startup.ts\" failed to run");
            },
        });
    };

    private isConnSet: boolean = false;
    private conn: Object = {};
    private response: Object;
    private _startupScript: string;
    private eclExecutor: any = new ECLExecutor();

    get config(): KernelConfig {
        let baseObj: KernelConfig = {
            cwd: this._workingDir,
            hideUndefined: this.hideUndefined,
            protocolVersion: this.protocolVer,
            startupCallback: this.onStartup,
            debug: this._onDebug,
            kernelInfoReply: this.response,
            startupScript: this._startupScript,
            eclExecutor: this.eclExecutor,
            transpile: (code: string) => {
                return ts.transpile(code, {});
            }
        };

        if (this.isConnSet) {
            baseObj.connection = this.conn;
        } else {
            Logger.throwAndExit("Error: missing {connectionFile}");
        }

        if (this._startupScript) {
            baseObj.startupScript = this._startupScript;
        }

        return baseObj;
    }

    set connectionWith(path: string) {
        if (this.isConnSet) {
            Logger.throwAndExit("Error: {connectionFile} cannot be duplicated");
        }

        this.isConnSet = true;
        this.conn = JSON.parse(fs.readFileSync(path).toString());
    }

    onDebug() {
        this._onDebug = true;
    }

    hideUndef() {
        this.hideUndefined = true;
    }

    showUndef() {
        this.hideUndefined = true;
    }

    set workingDir(path: string) {
        this._workingDir = path;
    }

    set protocolVersion(ver: string) {
        this.protocolVer = ver;
        let majorVersion: number = parseInt(ver.split(".")[0]);

        if (majorVersion <= 4) {
            let tsVersion = ts.version.split(".")
                .map(function (v) {
                    return parseInt(v, 10);
                });
            let protocolVersion = ver.split(".")
                .map(function (v) {
                    return parseInt(v, 10);
                });
            this.response = {
                "language": "typescript",
                "language_version": tsVersion,
                "protocol_version": protocolVersion,
            };
        } else {
            let itseclVersion = JSON.parse(
                fs.readFileSync(path.join(__dirname, "..", "package.json")).toString()
            ).version;
            this.response = {
                "protocol_version": ver,
                "implementation": "tsecl",
                "implementation_version": itseclVersion,
                "language_info": {
                    "name": "typescript",
                    "version": ts.version,
                    "mimetype": "text/x-typescript",
                    "file_extension": ".ts"
                },
                "banner": (
                    "ITSECL v" + itseclVersion + "\n" +
                    "https://github.com/hpcc-systems/itsecl\n"
                ),
                "help_links": [{
                    "text": "TypeScript Doc",
                    "url": "http://typescriptlang.org/docs/",
                }],
            };

        }
    }

    set startupScript(script: string) {
        this._startupScript = script;
    }
}

class Parser {
    static parse(): KernelConfig {
        let configBuilder = new Configuration();
        let argv = process.argv.slice(2);

        for (let arg of argv) {
            let [name, ...values] = arg.slice(2).split("=");
            switch (name) {
                case "debug":
                    configBuilder.onDebug();
                    Logger.onVerbose();
                    break;
                case "hide-undefined":
                    configBuilder.hideUndef();
                    break;
                case "protocol":
                    configBuilder.protocolVersion = values.join("=");
                    break;
                case "session-working-dir":
                    configBuilder.workingDir = values.join("=");
                    break;
                case "show-undefined":
                    configBuilder.showUndef();
                    break;
                case "startup-script":
                    configBuilder.startupScript = values.join("=");
                    break;
                default:
                    configBuilder.connectionWith = arg;
                    break;
            }
        }

        return configBuilder.config;
    }
}

if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}

let config = Parser.parse();

// Start kernel
let kernel = new Kernel(config);

// WORKAROUND: Fixes https://github.com/n-riesco/ijavascript/issues/97
kernel.handlers.is_complete_request = function is_complete_request(request) {
    request.respond(this.iopubSocket, "status", {
        execution_state: "busy"
    });

    let content = {};
    try {
        new vm.Script(request.content.code);
        content = {
            status: "complete",
        };
    } catch (err) {
        content = {
            status: "incomplete",
            indent: "",
        };
    }

    request.respond(
        this.shellSocket,
        "is_complete_reply",
        content,
        {},
        this.protocolVersion
    );

    request.respond(this.iopubSocket, "status", {
        execution_state: "idle"
    });
};


// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function () {
    Logger.log("Interrupting kernel");
    kernel.restart(); // TODO(NR) Implement kernel interruption
});
