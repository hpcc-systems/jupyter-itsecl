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

//import fs = require("fs");
//import path = require("path");

export class Logger {
    private static usage = `
Usage: node kernel.js [--debug] [--hide-undefined] [--protocol=Major[.minor[.patch]]] [--session-working-dir=path] [--show-undefined] [--startup-script=path] connection_file
`;

    static log: (...msgs: any[]) => void = () => {
    }

    static onVerbose() {
        Logger.log = (...msgs: any[]) => {
            process.stderr.write("KERNEL: ");
            console.error(msgs.join(" "));
        };
    }

    static onProcessDebug() {
        try {
            let debugging = require("debug")("KERNEL:");
            Logger.log = (...msgs: any[]) => {
                debugging(msgs.join(" "));
            };
        } catch (err) {
            Logger.onVerbose();
        }
    }

    static throwAndExit(...msgs: any[]) {
        console.error(msgs.join(" "));
        Logger.printUsage();
        process.exit(1);
    }

    static printUsage() {
        console.error(Logger.usage);
    }
}
