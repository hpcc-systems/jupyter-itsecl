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

// import console = require("console");
import {exec, spawn} from "child_process";
import fs = require("fs");
import os = require("os");
import path = require("path");
let uuid = require("uuid");

// Setup logging helpers
class Logger {
    private static usage: string = `ITSECL Notebook

Usage:
  itsecl <options>

The recognized options are:
  --help                        show ITSECL & notebook help
  --ts-debug                    enable debug log level
  --ts-help                     show ITSECL help
  --ts-hide-undefined           do not show undefined results
  --ts-install=[local|global]   install ITSECL kernel
  --ts-protocol=version         set protocol version, e.g. 4.1
  --ts-show-undefined           show undefined results
  --ts-startup-script=path      run script on startup
                                (path can be a file or a folder)
  --ts-working-dir=path         set session working directory
                                (default = current working directory)
  --version                     show ITSECL version

and any other options recognized by the Jupyter notebook; run:

  jupyter notebook --help

for a full list.

Disclaimer:
  ITSECL notebook and itsecl kernel are modified version of IJavascript notebook and itsecl kernels.
  Copyrights of original codes/algorithms belong to IJavascript developers.
`;

    static log: (...msgs: any[]) => void = () => {
    }

    static onVerbose() {
        Logger.log = (...msgs: any[]) => {
            process.stderr.write("ITS: ");
            console.error(msgs.join(" "));
        };
    }

    static onProcessDebug() {
        try {
            let debugging = require("debug")("ITS:");
            Logger.log = function (...msgs: any[]) {
                debugging(msgs.join(" "));
            };
        } catch (err) {
            Logger.onVerbose();
        }
    }

    static throwAndExit(printUsage: boolean, printContext: boolean, ...msgs: any[]) {
        console.error(msgs.join(" "));
        if (printUsage) {
            Logger.printUsage();
        }
        if (printContext) {
            Logger.printContext();
        }
        process.exit(1);
    }

    static printUsage() {
        console.error(Logger.usage);
    }

    static printContext() {
        Logger.log(Path.toString());
        Logger.log(Arguments.toString());
        Logger.log(Flags.toString());
        Logger.log(Protocol.toString());
        Logger.log(Frontend.toString());
    }
}

class Path {
    private static _node: string = process.argv[0];
    private static _root: string = path.dirname(
        path.dirname(fs.realpathSync(process.argv[1])) as string
    );

    static toString() {
        return `
        PATH: [node: "${Path._node}", root: "${Path._root}"]`;
    }

    static at(...rest: string[]): string {
        return path.join(Path._root, ...rest);
    }

    static get node(): string {
        return Path._node;
    }

    static get kernel(): string {
        return Path.at("lib", "kernel.js");
    }

    static get images(): string {
        return Path.at("images");
    }
}

enum InstallLoc {local, global}

class Flags {

    private static debug: boolean = false;
    private static install: InstallLoc;
    private static startup: string;
    private static cwd: string;

    static toString() {
        return `
        FLAG: [debug? ${Flags.debug ? "on" : "off"},
               installAt: "${Flags.install}",
               startupScript: "${Flags.startup}",
               workingDirectory: "${Flags.cwd}"]`;
    }

    static onDebug() {
        Flags.debug = true;
    }

    static set installAt(flag: string) {
        let loc = InstallLoc[flag];
        if (loc == null) {
            Logger.throwAndExit(true, false, "Invalid flag for install location", flag);
        }
        Flags.install = loc;
    }

    static set startUpScript(script: string) {
        Flags.startup = script;
    }

    static set workingDir(loc: string) {
        Flags.cwd = loc;
    }

    static get startScript() {
        return Flags.startup;
    }

    static get working() {
        return Flags.cwd;
    }

    static get installPath() {
        return Flags.install;
    }
}

/**
 * @property {String[]} context.args.kernel   Command arguments to run kernel
 * @property {String[]} context.args.frontend Command arguments to run frontend
 **/
class Arguments {
    private static _kernel: string[] = [
        Path.node,
        Path.kernel
    ];
    private static _frontend: string[] = [
        "jupyter",
        "notebook",
    ];

    static toString() {
        return `
        KernelArgs: [${Arguments._kernel.join(",")}],
        FrontendArgs: [${Arguments._frontend.join(",")}]`;
    }

    static get kernel() {
        return Arguments._kernel;
    }

    static get frontend() {
        return Arguments._frontend;
    }

    static passToKernel(...args: string[]) {
        Arguments._kernel.push(args.join("="));
    }

    static passToFrontend(...args: string[]) {
        Arguments._frontend.push(args.join("="));
    }

    static callFrontendWith(path: string) {
        Arguments._frontend[0] = path;
    }
}

class Protocol {
    private static _version: string;
    private static _majorVersion: number;

    static toString() {
        return `
        PROTOCOL: version ${Protocol._version}`;
    }

    static set version(ver: string) {
        Protocol._version = ver;
        Protocol._majorVersion = parseInt(ver.split(".", 1)[0]);
    }

    private static setup() {
        if (!Protocol._version) {
            if (Frontend.majorVersion < 3) {
                Protocol.version = "4.1";
            } else {
                Protocol.version = "5.0";
            }
        }
    }

    static get version() {
        Protocol.setup();
        return Protocol._version;
    }

    static get majorVersion() {
        Protocol.setup();
        return Protocol._majorVersion;
    }
}

class Frontend {
    static error: Error;
    private static _version: string;
    private static _majorVersion: number;

    static toString() {
        return `
        FRONTEND: version ${Frontend._version}
                  error: ${Frontend.error ? Frontend.error : "NO ERROR" }`;
    }

    static set version(ver: string) {
        Frontend._version = ver;
        Frontend._majorVersion = parseInt(ver.split(".")[0]);

        if (isNaN(Frontend.majorVersion)) {
            Logger.throwAndExit(false, true,
                "Error parsing Jupyter/Ipython version:",
                ver
            );
        }
    }

    static get version() {
        return Frontend._version;
    }

    static get majorVersion() {
        return Frontend._majorVersion;
    }
}

class Main {
    static readonly packageJSON: {version: string} = JSON.parse(
        fs.readFileSync(Path.at("package.json")).toString()
    );

    static prepare(callback?: () => void) {
        let extraArgs: string[] = process.argv.slice(2);

        for (let e of extraArgs) {
            let [name, ...values] = e.slice(2).split("=");
            if (name.lastIndexOf("ts", 0) === 0) {
                let subname = name.slice(3);
                switch (subname) {
                    case "debug":
                        Logger.onVerbose();
                        Flags.onDebug();
                        Arguments.passToKernel("--debug");
                        break;
                    case "hide-undefined":
                    case "show-undefined":
                        Arguments.passToKernel(`--${subname}`);
                        break;
                    case "help":
                        Logger.printUsage();
                        process.exit(0);
                        break;
                    case "install":
                        Flags.installAt = values[0];
                        break;
                    case "install-kernel":
                        Flags.installAt = "local";
                        break;
                    case "protocol":
                        Protocol.version = values[0];
                        break;
                    case "startup-script":
                        Flags.startUpScript = values.join("=");
                        break;
                    case "working-dir":
                        Flags.workingDir = values.join("=");
                        break;
                    default:
                        Logger.throwAndExit(true, false, "Unknown flag", e);
                }
            } else {
                switch (name) {
                    case "help":
                        Logger.printUsage();
                        Arguments.passToFrontend(e);
                        break;
                    case "version":
                        console.log(Main.packageJSON.version);
                        process.exit(0);
                        break;
                    case "KernelManager.kernel_cmd":
                        console.warn(`Warning: Flag "${ e }" skipped`);
                        break;
                    default:
                        Arguments.passToFrontend(e);
                }
            }
        }

        if (Flags.startScript) {
            Arguments.passToKernel("--startup-script", Flags.startScript);
        }

        if (Flags.working) {
            Arguments.passToKernel("--session-working-dir", Flags.working);
        }

        Arguments.passToKernel("{connection_file}");

        if (callback) {
            callback();
        }
    }

    static setProtocol() {
        Arguments.passToKernel("--protocol", Protocol.version);

        if (Frontend.majorVersion < 3) {
            Arguments.passToFrontend(
                "--KernelManager.kernel_cmd", `['${ Arguments.kernel.join("', '") }']`,
            );
        }

        if (Frontend.majorVersion < 3 &&
            Protocol.majorVersion >= 5) {
            console.warn("Warning: Protocol v5+ requires Jupyter v3+");
        }
    }

    static setJupyterInfoAsync(callback?: () => void) {
        exec("jupyter notebook --version", function (error, stdout) {
            if (error) {
                Frontend.error = error;
                Main.setIPythonInfoAsync(callback);
                return;
            }

            Arguments.callFrontendWith("jupyter");
            Frontend.version = stdout.toString().trim();

            if (callback) {
                callback();
            }
        });
    }

    static setIPythonInfoAsync(callback?: () => void) {
        exec("ipython --version", function (error, stdout) {
            if (error) {
                if (Frontend.error) {
                    console.error("Error running `jupyter --version`");
                    console.error(Frontend.error.toString());
                }
                Logger.throwAndExit(false, true,
                    "Error running `ipython --version`\n",
                    error.toString()
                );
            }

            Arguments.callFrontendWith("ipython");
            Frontend.version = stdout.toString().trim();

            if (callback) {
                callback();
            }
        });
    }

    static makeTmpdir(maxAttempts: number = 10): string {
        let attempts = 0;
        let tmpdir: string;

        while (!tmpdir) {
            attempts++;
            try {
                tmpdir = path.join(os.tmpdir(), uuid.v4());
                fs.mkdirSync(tmpdir);
            } catch (e) {
                if (attempts >= maxAttempts) {
                    Logger.throwAndExit(false, false, "Cannot make a temp directory!");
                }
                tmpdir = null;
            }
        }

        return tmpdir;
    }

    static copyAsync(srcDir: string, dstDir: string,
                     callback?: (...dstFiles: string[]) => void, ...images: string[]) {
        let dstFiles: string[] = [];
        let callStack: (() => void)[] = [];
        if (callback) {
            callStack.push(function () {
                callback(...dstFiles);
            });
        }

        for (let img of images) {
            let src = path.join(srcDir, img);
            let dst = path.join(dstDir, img);
            dstFiles.push(dst);

            callStack.push(function () {
                let readStream = fs.createReadStream(src);
                let writeStream = fs.createWriteStream(dst);
                readStream.on("end", function () {
                    let top = callStack.pop();
                    top();
                });
                readStream.pipe(writeStream);
            });
        }

        let top = callStack.pop();
        top();
    }

    static installKernelAsync(callback?: () => void) {
        if (Frontend.majorVersion < 3) {
            if (Flags.installPath) {
                console.error(
                    "Error: Installation of kernel specs requires Jupyter v3+"
                );
            }

            if (callback) {
                callback();
            }

            return;
        }

        // Create temporary spec folder
        let tmpdir = Main.makeTmpdir();
        let specDir = path.join(tmpdir, "tsecl");
        fs.mkdirSync(specDir);

        // Create spec file
        let specFile = path.join(specDir, "kernel.json");
        let spec = {
            argv: Arguments.kernel,
            // display_name: `TSECL  ${Main.packageJSON.version.replace(/([0-9]+\.[0-9]+)\..*/g,"$1")}`,
            display_name: "HPCC ECL - TSECL",
            language: "typescript",
        };
        fs.writeFileSync(specFile, JSON.stringify(spec));

        // Copy logo files
        let logoDir = path.join(Path.images);
        Main.copyAsync(logoDir, specDir, function (...dstFiles: string[]) {
            // Install kernel spec
            let args = [
                Arguments.frontend[0],
                "kernelspec install --replace",
                specDir,
            ];

            if (Flags.installPath !== InstallLoc.global) {
                args.push("--user");
            }

            let cmd = args.join(" ");
            exec(cmd, function (error, stdout, stderr) {
                // Remove temporary spec folder
                fs.unlinkSync(specFile);
                for (let file of dstFiles) {
                    fs.unlinkSync(file);
                }
                fs.rmdirSync(specDir);
                fs.rmdirSync(tmpdir);

                if (error) {
                    Logger.throwAndExit(
                        false, true,
                        `Error running "${cmd}"\n`,
                        error.toString(),
                        "\n",
                        stderr ? stderr.toString() : ""
                    );
                }

                if (callback) {
                    callback();
                }
            });
        }, "logo-32x32.png", "logo-64x64.png");
    }

    static spawnFrontend() {
        let [cmd, ...args] = Arguments.frontend;
        let frontend = spawn(cmd, args, {
            stdio: "inherit"
        });

        // Relay SIGINT onto the frontend
        // let signal = "SIGINT";
        process.on("SIGINT", function () {
            frontend.emit("SIGINT");
        });
    }
}

if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}

Main.prepare(function () {
    Main.setJupyterInfoAsync(function () {
        Main.setProtocol();
        Main.installKernelAsync(function () {
            Logger.printContext();

console.log(Flags);


           if (!Flags.installPath) {
               Main.spawnFrontend();
            }

        });
    });
});
