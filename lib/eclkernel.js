#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var comms_1 = require("@hpcc-js/comms");
//import { WUAction } from "@hpcc-js/comms";
var logging_1 = require("./logging");
var util = require("util");
var os = require("os");
var path = require("path");
var mkdirp = require("mkdirp");
var ECLResult = /** @class */ (function () {
    function ECLResult() {
        this.mime = {};
        this.error = { ename: "", evalue: "", traceback: [] };
    }
    ECLResult.prototype.renderInHtml = function (rows) {
        if (rows.length == 0) {
            this.mime['text/html'] = "No Result";
            return;
        }
        var htmlTable = "WUID: " + this.wuid + ", number of results: " + String(this.numOfResults) + "\n";
        htmlTable = htmlTable + "<table style=\"border:1px; cellspacing:0; cellpadding:0; width: 100%; text-align:left\">\n";
        htmlTable = htmlTable + "<tr><th>##</th>";
        for (var k in rows[0]) {
            htmlTable = htmlTable + "<th>" + k.trim() + "</th>";
        }
        htmlTable = htmlTable + "</tr>\n";
        for (var i = 0; i < rows.length; i++) {
            htmlTable = htmlTable + "<tr><td>" + (i + 1) + "</td>";
            for (var k in rows[i]) {
                var v = rows[i][k];
                //if (typeof (v) == "string" ) {
                //    v = v.trim();
                //}
                htmlTable = htmlTable + "<td>" + v + "</td>";
            }
            htmlTable = htmlTable + "</tr>\n";
        }
        htmlTable = htmlTable + "</table>";
        this.mime['text/html'] = htmlTable;
    };
    ECLResult.prototype.setError = function (e) {
        this.error.ename = (e && e.name) ? e.name : typeof e;
        this.error.evalue = (e && e.message) ? e.message : util.inspect(e);
        this.error.traceback = (e && e.stack) ? e.stack.split("\n") : [];
    };
    return ECLResult;
}());
exports.ECLResult = ECLResult;
/**
 * @class
 * @classdesc Implements HPCC ESP Connection and ECL code submittion for JS-ECL kernel
 */
var ECLExecutor = /** @class */ (function () {
    function ECLExecutor() {
        var _this = this;
        this.ip = "localhost";
        this.port = 0;
        this.secure = false;
        this.cluster = "hthor";
        this.user = "";
        this.password = "";
        this.defaultTask = "ECL";
        this.configFile = "";
        this.eclccPath = "";
        this.workspace = ".\/";
        this.includeFolders = "";
        this.buildVersion = "";
        this.resultLimit = 100;
        this.eclResult = new ECLResult();
        comms_1.locateClientTools(this.eclccPath, this.buildVersion, this.workspace, this.includeFolders.split(","), false).then(function (ct) {
            _this.eclccPath = ct.eclccPath;
        }).catch(function (e) {
        });
    }
    Object.defineProperty(ECLExecutor.prototype, "config", {
        get: function () {
            var hpccConfig = {
                ip: this.ip,
                port: this.port,
                secure: this.secure,
                cluster: this.cluster,
                user: this.user,
                password: this.password,
                eclccPath: this.eclccPath,
                workspace: this.workspace,
                buildVersion: this.buildVersion,
                includeFolders: this.includeFolders,
                resultLimit: this.resultLimit
            };
            return hpccConfig;
        },
        enumerable: true,
        configurable: true
    });
    ECLExecutor.prototype.getValue = function (str, key) {
        var re = new RegExp(key + "\\s*=\\s*[^;]*;", 'i');
        var match = str.match(re);
        if (match != null) {
            return match[0].split('=')[1].replace(";", "").trim();
        }
        return "";
    };
    ECLExecutor.prototype.setConfig = function (code) {
        var match = code.match(/^\s*\/\/CONN.*/i);
        if (match == null) {
            return;
        }
        var line = match[0];
        if (line.search("file\s*=")) {
            var file = this.getValue(line, "file");
            this.getConfigFromFile(file);
        }
        this.getConfigFromString(line);
        if (this.workspace.substr(-1) != "\/") {
            this.workspace = this.workspace + "\/";
        }
        if (line.search(/^\s*\/\/CONN\s* default.*/i) >= 0) {
            this.defaultTask = "CONN";
        }
        else if (line.search(/^\s*\/\/JS\s* default.*/i) >= 0) {
            this.defaultTask = "JS";
        }
        else if (line.search(/^\s*\/\/ECL\s* default.*/i) >= 0) {
            this.defaultTask = "ECL";
        }
    };
    ECLExecutor.prototype.getConfigFromString = function (str) {
        if (str.search("ip\s*=") >= 0) {
            this.ip = this.getValue(str, "ip");
        }
        if (str.search("port\s*=") >= 0) {
            this.port = Number(this.getValue(str, "port"));
        }
        if (str.search("secure\s*=") >= 0) {
            this.secure = Boolean(this.getValue(str, "secure"));
        }
        if (str.search("cluster\s*=") >= 0) {
            this.cluster = this.getValue(str, "cluster");
        }
        if (str.search("default\s*=") >= 0) {
            this.defaultTask = this.getValue(str, "default");
        }
        if (str.search("user\s*=") >= 0) {
            this.user = this.getValue(str, "user");
        }
        if (str.search("password\s*=") >= 0) {
            this.password = this.getValue(str, "password");
        }
    };
    ECLExecutor.prototype.getESPURL = function () {
        var espURL = (this.secure) ? "https" : "http";
        espURL = espURL + "://" + this.ip;
        var port = (this.secure) ? 18010 : 8010;
        if (this.port > 0) {
            port = this.port;
        }
        espURL += ":" + port;
        return espURL;
    };
    ECLExecutor.prototype.getConfigFromFile = function (file) {
        if (fs.existsSync(file)) {
            var content = fs.readFileSync(file, 'utf8');
            var str = content.replace(/\n/g, ";").replace(/\r/g, "").replace(/;\s*;/g, ";");
            this.getConfigFromString(str);
        }
    };
    /**
     * Check type of the task from code
     *
     * @param {String} code
     */
    ECLExecutor.prototype.taskType = function (code) {
        if (code.search(/^\s*\/\/CONN/i) >= 0) {
            return "CONN";
        }
        else if (code.search(/^\s*\/\/ECL/i) >= 0) {
            return "ECL";
        }
        else if (code.search(/^\s*\/\/JS/i) >= 0) {
            return "JS";
        }
        else if (code.search(/^\s*\/\/CONF/i) >= 0) {
            return "CONF";
        }
        else {
            return this.defaultTask;
        }
    };
    /**
     * HPCC Handler for 'execute_request' message
     *
     * code @param {module:jmp~Message} request Request message
     */
    ECLExecutor.prototype.execute_request = function (base, request) {
        var task_type = this.taskType(request.content.code);
        var code = request.content.code;
        if (task_type == "CONN") {
            // parse code to get hpccConfig
            this.setConfig(code);
            //construct code for connection test
            code = "'Connection with HPCC ESP server succeed';";
        }
        else { // ECL
            if (code.search(/^\s*\/\/ECL\s* cluster.*/i) >= 0) {
                this.cluster = this.getValue(code, "cluster");
            }
            // remove "//ECL" from request.code
            code = code.replace(/^\s*\/\/ECL[^\n]*\n/, "");
        }
        this.beforeRun(base, request);
        if (task_type == "CONF") {
            var configStr = "ip=" + this.ip + " port=" + this.port + " secure=" + this.secure +
                " cluster=" + this.cluster + " user=" + this.user + " default=" + this.defaultTask + "\n" +
                "eclcc: " + this.eclccPath + " workspace: " + this.workspace;
            var result = { mime: { 'text/plain': '\'Config: ' + configStr + '\'' } };
            this.onSuccess(base, request, result);
            this.afterRun(base, request);
            return;
        }
        var ESP_URL = this.getESPURL();
        var executor = this;
        //Logger.log ("ESP_URL: " + ESP_URL);
        //Logger.log ("code: " + code);
        //Logger.log ("Type: " + task_type);
        //Logger.log ("eclcc: " + this.eclccPath);
        if (this.eclccPath && task_type == "ECL") {
            executor.submitJobThroughCT(base, request, task_type, code);
        }
        else {
            executor.submitJobToEsp(base, request, task_type, code);
        }
    };
    /**
     * Create workunit
     *
     */
    ECLExecutor.prototype.createWorkunit = function () {
        var ESP_URL = this.getESPURL();
        return comms_1.Workunit.create({
            baseUrl: ESP_URL,
            userID: this.user,
            password: this.password,
            rejectUnauthorized: false
        });
    };
    /**
     * Submit ECL job to through ClientTools
     *
     * @param {String} code
     */
    ECLExecutor.prototype.submitJobThroughCT = function (base, request, task_type, code) {
        var _this = this;
        var executor = this;
        var ESP_URL = this.getESPURL();
        var program = "program.ecl";
        var module = "";
        var save_only = false;
        // To re-use the code start with "///<module>/<an existing program file name> related to workspace directory" 
        var module_file = code.match(/[\s]*\/\/\/[\s]*([^\n]+)\n/i);
        if (module_file != null) {
            var match = module_file[1].match(/[\s]*([^\/]+)\/(.*)/i);
            if (match != null) {
                module = match[1].replace("/", "").trim();
                program = module + "/" + match[2].trim();
            }
            else {
                program = module_file[1].replace("/", "").trim();
            }
            match = program.match(/([^\s]+)\s+([^\s]+)/i);
            if (match != null) {
                program = match[1];
                save_only = true;
            }
            logging_1.Logger.log("Program: " + program);
            code = code.replace(/^\s*\/\/\/[^\n]*\n/, "");
        }
        var programPath = this.workspace;
        if (module) {
            programPath = programPath + module;
        }
        mkdirp(programPath, function (err) {
            executor.eclResult.mime = { 'text/plain': "Error to create directory " + programPath };
            executor.onError(base, request, executor.eclResult);
        });
        programPath = this.workspace + program;
        logging_1.Logger.log("Save " + programPath);
        fs.writeFile(programPath, code, function (err) {
            if (err) {
                executor.eclResult.mime = { 'text/plain': "Can't save code to " + programPath };
                executor.onError(base, request, executor.eclResult);
            }
        });
        if (save_only) {
            //executor.afterRun(base, request);
            return;
        }
        logging_1.Logger.log("Locating Client Tools." + os.EOL);
        comms_1.locateClientTools(this.eclccPath, this.buildVersion, this.workspace, this.includeFolders.split(","), false).then(function (clientTools) {
            logging_1.Logger.log("Client Tools: " + clientTools.eclccPath + os.EOL);
            logging_1.Logger.log("Generating archive." + os.EOL);
            return clientTools.createArchive(program);
        }).then(function (archive) {
            if (archive.err.hasError()) {
                throw new Error("ECL Syntax Error(s):\n  " + archive.err.errors().map(function (e) { return e.msg; }).join("\n  "));
            }
            return archive;
        }).then(function (archive) {
            logging_1.Logger.log("Creating workunit." + os.EOL);
            return _this.createWorkunit().then(function (wu) {
                var pathParts = path.parse(program);
                return wu.update({
                    Jobname: pathParts.name,
                    QueryText: archive.content,
                    ApplicationValues: {
                        ApplicationValue: [{
                                Application: "jupyter-ecl",
                                Name: "filePath",
                                Value: program
                            }]
                    }
                });
            });
        }).then(function (wu) {
            logging_1.Logger.log("Submitting workunit:  " + wu.Wuid + os.EOL);
            return wu.submit(_this.cluster, comms_1.WUUpdate.Action.Run, _this.resultLimit);
        }).then(function (wu) {
            logging_1.Logger.log("Submitted:  " + wu.Wuid + os.EOL);
            return wu.watchUntilComplete();
        }).then(function (wu) {
            _this.workunit = wu;
            executor.handleWorkUnitResult(base, request, wu, task_type);
            return wu;
        }).catch(function (e) {
            console.log(e);
            executor.eclResult.mime = { 'text/plain': e.message };
            executor.onSuccess(base, request, executor.eclResult);
            executor.afterRun(base, request);
        });
    };
    /**
     * Submit ECL job to ESP directly
     *
     * @param {String} code
     */
    ECLExecutor.prototype.submitJobToEsp = function (base, request, task_type, code) {
        var _this = this;
        var executor = this;
        var ESP_URL = this.getESPURL();
        logging_1.Logger.log("Submit job to ESP directly");
        comms_1.Workunit.submit({ baseUrl: ESP_URL, userID: this.user, password: this.password }, this.cluster, code).then(function (wu) {
            return wu.watchUntilComplete();
        }).then(function (wu) {
            _this.workunit = wu;
            return _this.handleWorkUnitResult(base, request, wu, task_type);
        }).then(function (wu) {
            if (task_type == "CONN") {
                return wu.delete();
            }
        }).catch(function (e) {
            console.log("catch error");
            console.log(e);
            executor.eclResult.setError(e);
            executor.onError(base, request, executor.eclResult);
        });
    };
    /**
     * Handle Workunit result
     *
     * @param {String} code
     */
    ECLExecutor.prototype.handleWorkUnitResult = function (base, request, wu, task_type) {
        var executor = this;
        if (wu.isFailed()) {
            return wu.fetchECLExceptions().then(function (eclExceptions) {
                //console.log(eclExceptions);
                var errMsg = "";
                for (var i = 0; i < eclExceptions.length; i++) {
                    errMsg = errMsg + eclExceptions[i]['Source'] + " " + eclExceptions[i]['Severity'] + ", Code: " + eclExceptions[i]['Code'];
                    errMsg = errMsg + " Line:" + eclExceptions[i]['LineNo'] + " Column:" + eclExceptions[i]['Column'];
                    errMsg = errMsg + "\nMessage: " + eclExceptions[i]['Message'] + "\n";
                }
                executor.eclResult.mime = { 'text/plain': errMsg };
                executor.onSuccess(base, request, executor.eclResult);
                executor.afterRun(base, request);
                return wu;
            });
        }
        else {
            return wu.fetchResults().then(function (results) {
                //console.log("WUID:" + wu.Wuid + "num of results: " + results.length);
                executor.eclResult.wuid = wu.Wuid;
                executor.eclResult.numOfResults = results.length;
                return results[0].fetchRows();
            }).then(function (rows) {
                //  Do Stuff With Results !!!
                if (task_type == "CONN") {
                    executor.eclResult.mime = { 'text/plain': rows[0]['Result_1'] };
                }
                else {
                    //executor.eclResult.mime = {'text/plain': 'ECL'};
                    executor.eclResult.renderInHtml(rows);
                }
                executor.onSuccess(base, request, executor.eclResult);
                executor.afterRun(base, request);
                return wu;
            });
        }
    };
    ECLExecutor.prototype.status_busy = function (base, request) {
        request.respond(base.iopubSocket, 'status', {
            execution_state: 'busy'
        });
    };
    ECLExecutor.prototype.status_idle = function (base, request) {
        request.respond(base.iopubSocket, 'status', {
            execution_state: 'idle'
        });
    };
    ECLExecutor.prototype.beforeRun = function (base, request) {
        this.status_busy(base, request);
        base.executionCount++;
        request.respond(base.iopubSocket, "execute_input", {
            execution_count: base.executionCount,
            code: request.content.code,
        });
    };
    ECLExecutor.prototype.afterRun = function (base, request) {
        this.status_idle(base, request);
    };
    ECLExecutor.prototype.onSuccess = function (base, request, result) {
        request.respond(base.shellSocket, "execute_reply", {
            status: "ok",
            execution_count: base.executionCount,
            payload: [],
            user_expressions: {},
        });
        if (!result.mime) {
            return;
        }
        if (base.hideUndefined &&
            result.mime["text/plain"] === "undefined") {
            return;
        }
        request.respond(base.iopubSocket, "execute_result", {
            execution_count: base.executionCount,
            data: result.mime,
            metadata: {},
        });
    };
    ECLExecutor.prototype.onError = function (base, request, result) {
        request.respond(base.shellSocket, "execute_reply", {
            status: "error",
            execution_count: base.executionCount,
            ename: result.error.ename,
            evalue: result.error.evalue,
            traceback: result.error.traceback,
        });
        request.respond(base.iopubSocket, "error", {
            execution_count: base.executionCount,
            ename: result.error.ename,
            evalue: result.error.evalue,
            traceback: result.error.traceback,
        });
    };
    return ECLExecutor;
}());
exports.ECLExecutor = ECLExecutor;
