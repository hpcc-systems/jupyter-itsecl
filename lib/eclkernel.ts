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


import * as fs from "fs";
import { Workunit, WUUpdate, locateAllClientTools, locateClientTools } from "@hpcc-js/comms";
//import { WUAction } from "@hpcc-js/comms";
import { Logger } from "./logging";
import * as util  from "util";
import os = require("os");
import path = require("path");

/*
var log = (...msgs: any[]) => {
            //process.stderr.write("KERNEL: ");
            console.error("ECL-KERNEL: " + msgs.join(" "));
        };
*/


export interface HPCCConfig {
    //  SP server ip address
    ip: string;

    // ESP port. The default is ECLWatch port 8010
    port: number;

    // HPCC cluster. The default is hthor
    cluster: string;

    // ESP user name
    user: string;

    // ESP user password
    password: string;

    //  eclcc path
    eclccPath: string;

    // workspace
    workspace: string;

    // include directories, comma separated
    includeFolders: string;

    // HPCC build version
    buildVersion: string;

    // Workunit result limit
    resultLimit: number;
}


export interface ECLSubmitResult {
   [key:string]: string;
}

export interface ECLSubmitError {
    ename:     string;
    evalue:    string;
    traceback: string;
}

export class ECLResult  {
    mime: ECLSubmitResult = {};
    error: ECLSubmitError = { ename: "", evalue: "", traceback: ""}
    wuid: string;
    numOfResults: number;

    renderInHtml(rows: any) {
       if (rows.length == 0 ) {
          this.mime['text/html'] = "No Result";
          return;
       }
       let htmlTable = "WUID: " + this.wuid + ", number of results: " + String(this.numOfResults) + "\n";

       htmlTable = htmlTable + "<table style=\"border:1px; cellspacing:0; cellpadding:0; width: 100%; text-align:left\">\n";
       htmlTable = htmlTable + "<tr><th>##</th>";
       for (let k in rows[0]) {
          htmlTable = htmlTable + "<th>" + k.trim() + "</th>";
       }
       htmlTable = htmlTable + "</tr>\n";

       for (let i=0; i < rows.length; i++) {
           htmlTable = htmlTable + "<tr><td>" + (i+1) + "</td>";
           for (let k in rows[i]) {
               let v = rows[i][k];
               //if (typeof (v) == "string" ) {
               //    v = v.trim();
               //}
               htmlTable = htmlTable + "<td>" + v + "</td>";
           }
           htmlTable = htmlTable + "</tr>\n";
       }
       htmlTable = htmlTable + "</table>";
       this.mime['text/html'] = htmlTable;
    }

    setError(e: any) {
       this.error.ename =  (e && e.name) ? e.name : typeof e;
       this.error.evalue =  (e && e.message) ? e.message : util.inspect(e);
       this.error.traceback =  (e && e.stack) ? e.stack.split("\n") : "";
    }
}

/**
 * @class
 * @classdesc Implements HPCC ESP Connection and ECL code submittion for JS-ECL kernel
 */
export class ECLExecutor  {

     protected ip: string  = "localhost";
     protected port: number = 8010;
     protected cluster: string  = "hthor";
     protected user: string = "";
     protected password: string = "";
     protected defaultTask: string = "ECL";
     protected configFile: string = "";
     protected eclccPath: string = "";
     protected workspace: string = ".\/";
     protected includeFolders: string = "";
     protected buildVersion: string = "";
     protected workunit: Workunit;
     protected resultLimit: number = 100;
     eclResult = new ECLResult();

     constructor () {
        locateClientTools(this.eclccPath, this.buildVersion, this.workspace,
              this.includeFolders!.split(","), false).then((ct) => {
                  this.eclccPath = ct.eclccPath;

        }).catch((e) => { // Ignore if doesn't detect ClientTools
        });
     }
     get config(): HPCCConfig {
         let hpccConfig: HPCCConfig = {
             ip:             this.ip,
             port:           this.port,
             cluster:        this.cluster,
             user:           this.user,
             password:       this.password,
             eclccPath:      this.eclccPath,
             workspace:      this.workspace,
             buildVersion:   this.buildVersion,
             includeFolders: this.includeFolders,
             resultLimit:    this.resultLimit
         };
         return hpccConfig;
     }

     getValue(str:string, key:string): string {
         let re = new RegExp(key + "\s*=\s*[^;]*;", 'i');
         let match = str.match(re);
         if (match != null) {
             return match[0].split('=')[1].replace(";", "").trim();
         }
         return "";
     }

     setConfig(code: string) {
         let match = code.match(/^\s*\/\/CONN.*/i);
         if (match == null) {
             return;
         }
         let line = match[0];
         if (line.search("file\s*=")) {
            let file = this.getValue(line, "file");
            this.getConfigFromFile(file);
         }
         this.getConfigFromString(line);

         if (this.workspace.substr(-1) != "\/") {
           this.workspace = this.workspace + "\/";
         }

         if (line.search(/^\s*\/\/CONN\s* default.*/i) >= 0) {
             this. defaultTask = "CONN";
         } else if (line.search(/^\s*\/\/JS\s* default.*/i) >= 0 ) {
             this.defaultTask = "JS";
         } else if (line.search(/^\s*\/\/ECL\s* default.*/i) >= 0) {
             this.defaultTask = "ECL";
         }
     }

     getConfigFromString(str: string): void {
         if (str.search("ip\s*=") >= 0) {
             this.ip = this.getValue(str, "ip");
         }
         if (str.search("port\s*=") >= 0) {
             this.port = Number(this.getValue(str, "port"));
         }
         if (str.search("cluster\s*=") >=0 ) {
             this.cluster = this.getValue(str, "cluster");
         }
         if (str.search("default\s*=") >= 0) {
             this.defaultTask = this.getValue(str, "default");
         }
         if (str.search("user\s*=") >=0) {
             this.user = this.getValue(str, "user");
         }
         if (str.search("password\s*=") >=0) {
             this.password = this.getValue(str, "password");
         }
     }

     getConfigFromFile(file:string): void {
         if (fs.existsSync(file)) {
             let content =   fs.readFileSync(file, 'utf8');
             let str = content.replace(/\n/g, ";").replace(/\r/g, "").replace(/;\s*;/g, ";");
             this.getConfigFromString(str);
         }
     }


    /**
     * Check type of the task from code
     *
     * @param {String} code
     */
    taskType(code: string): string {
        if (code.search(/^\s*\/\/CONN/i) >= 0) {
           return "CONN";
        } else if (code.search(/^\s*\/\/ECL/i) >= 0) {
           return "ECL";
        } else if (code.search(/^\s*\/\/JS/i) >= 0) {
           return "JS";
        } else if (code.search(/^\s*\/\/CONF/i) >= 0) {
           return "CONF";
        } else {
           return this.defaultTask;
        }
    }


    /**
     * HPCC Handler for 'execute_request' message
     *
     * code @param {module:jmp~Message} request Request message
     */
    execute_request(base: any, request: any) {
        let task_type = this.taskType(request.content.code);
        let code = request.content.code;

        if (task_type == "CONN")  {
           // parse code to get hpccConfig
           this.setConfig(code);
           //construct code for connection test
           code = "'Connection with HPCC ESP server succeed';";
        } else { // ECL
           if (code.search(/^\s*\/\/ECL\s* cluster.*/i) >= 0) {
             this.cluster = this.getValue(code, "cluster");
           }
           // remove "//ECL" from request.code
           code = code.replace(/^\s*\/\/ECL[^\n]*\n/, "");

        }

        this.beforeRun(base, request);

        if (task_type == "CONF")  {
           let configStr = "ip="+this.ip + " port=" + this.port + " cluster=" + this.cluster +
           " user=" + this.user + " default=" + this.defaultTask + "\n" +
           "eclcc: " + this.eclccPath + " workspace: " + this.workspace;
           let result = { mime: { 'text/plain': '\'Config: ' + configStr + '\'' } };
           this.onSuccess(base, request, result);
           this.afterRun(base, request);
           return;
        }

        let ESP_URL = "http://" + this.ip + ":" + this.port;
        let executor = this;
        //Logger.log ("ESP_URL: " + ESP_URL);
        //Logger.log ("code: " + code);
        //Logger.log ("Type: " + task_type);
        //Logger.log ("eclcc: " + this.eclccPath);

        if (this.eclccPath && task_type == "ECL")  {
           executor.submitJobThroughCT(base, request, task_type, code);
        } else {
           executor.submitJobToEsp(base, request, task_type, code);
        }

    }

    /**
     * Create workunit
     *
     */
    createWorkunit() {
       let ESP_URL = "http://" + this.ip + ":" + this.port;
       return Workunit.create({
          baseUrl: ESP_URL,
          userID: this.user,
          password: this.password,
          rejectUnauthorized: false
       });
    }

    /**
     * Submit ECL job to through ClientTools
     *
     * @param {String} code
     */
    submitJobThroughCT(base: any, request: any, task_type: string, code: string) {
        let executor = this;
        let ESP_URL = "http://" + this.ip + ":" + this.port;
        let program = "program.ecl";

        // To re-use the code start with "///<an existing program file name> related to workspace directory"
        let re = new RegExp("\s*\/\/\/\s*([^\n]+)\n", 'i');
        let match = code.match(re);
        if (match != null) {
            // Logger.log("match[1]: " + match[1]);
            program = match[1].replace("/","").trim();
            code = code.replace(/^\s*\/\/\/[^\n]*\n/, "");
        }

        let programPath = this.workspace + program;
        Logger.log ("Save " + programPath);

        fs.writeFile(programPath, code, (err) => {
           if (err) {
              executor.eclResult.mime = {'text/plain': "Can't save code to " + programPath};
              executor.onError(base, request, executor.eclResult);
           }
        });

        Logger.log("Locating Client Tools." + os.EOL);
        locateClientTools(this.eclccPath, this.buildVersion, this.workspace,
           this.includeFolders!.split(","), false).then((clientTools) => {
           Logger.log("Client Tools: " + clientTools.eclccPath + os.EOL);
           Logger.log("Generating archive." + os.EOL);
           return clientTools.createArchive(program);
        }).then(archive => {
           if (archive.err.hasError()) {
                throw new Error(`ECL Syntax Error(s):\n  ${archive.err.errors().map(e => e.msg).join("\n  ")}`);
            }
            return archive;
        }).then(archive => {
           Logger.log("Creating workunit." + os.EOL);
           return this.createWorkunit().then((wu) => {
              const pathParts = path.parse(program);
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
        }).then((wu) => {
            Logger.log("Submitting workunit:  " + wu.Wuid + os.EOL);
            return wu.submit(this.cluster, WUUpdate.Action.Run, this.resultLimit);
        }).then((wu) => {
            Logger.log("Submitted:  " + wu.Wuid + os.EOL);
            return wu.watchUntilComplete();
        }).then((wu) => {
            this.workunit = wu;
            executor.handleWorkUnitResult(base, request, wu, task_type);
            return wu;
        }).catch((e) => { // error handle
           console.log(e);
           executor.eclResult.mime = {'text/plain': e.message};
           executor.onSuccess(base, request, executor.eclResult);
           executor.afterRun(base, request);
        });
    }

    /**
     * Submit ECL job to ESP directly
     *
     * @param {String} code
     */
    submitJobToEsp(base: any, request: any, task_type: string, code: string) {

       let executor = this;
       let ESP_URL = "http://" + this.ip + ":" + this.port;
       Logger.log("Submit job to ESP directly");
       Workunit.submit({ baseUrl: ESP_URL, userID: this.user, password: this.password }, this.cluster, code).then((wu) => {
          return wu.watchUntilComplete();
       }).then((wu) => {
          this.workunit = wu;
          return   this.handleWorkUnitResult(base, request, wu, task_type);
       }).then((wu) => {
          if ( task_type == "CONN" ) {
             return wu.delete();
          }
       }).catch((e) => { // error handle
          console.log("catch error");
          console.log(e);
          executor.eclResult.setError(e);
          executor.onError(base, request, executor.eclResult);
       });
    }


    /**
     * Handle Workunit result
     *
     * @param {String} code
     */
    handleWorkUnitResult(base: any, request:any, wu:Workunit, task_type:string) {
       let executor = this;

       if (wu.isFailed()) {
          return wu.fetchECLExceptions().then((eclExceptions) => {
             //console.log(eclExceptions);
             let errMsg = "";
             for (let i=0; i < eclExceptions.length; i++) {
                errMsg = errMsg +  eclExceptions[i]['Source'] + " " + eclExceptions[i]['Severity'] + ", Code: " +  eclExceptions[i]['Code'];
                errMsg = errMsg +  " Line:" + eclExceptions[i]['LineNo'] + " Column:" +  eclExceptions[i]['Column'];
                errMsg = errMsg +  "\nMessage: " + eclExceptions[i]['Message'] + "\n";
             }
             executor.eclResult.mime = {'text/plain': errMsg};
             executor.onSuccess(base, request, executor.eclResult);
             executor.afterRun(base, request);
             return wu;
          });
       }
       else {
          return wu.fetchResults().then((results) => {
             //console.log("WUID:" + wu.Wuid + "num of results: " + results.length);
             executor.eclResult.wuid = wu.Wuid;
             executor.eclResult.numOfResults = results.length;
             return results[0].fetchRows();
          }).then((rows) => {
             //  Do Stuff With Results !!!
             if (task_type == "CONN")  {
                executor.eclResult.mime = {'text/plain': rows[0]['Result_1']};
             } else {
                //executor.eclResult.mime = {'text/plain': 'ECL'};
                executor.eclResult.renderInHtml(rows);
             }
             executor.onSuccess(base, request, executor.eclResult);
             executor.afterRun(base, request);
             return wu;
          });
       }
    }



    status_busy(base: any, request: any) {
        request.respond(base.iopubSocket, 'status', {
            execution_state: 'busy'
        });
    }


    status_idle(base: any, request: any) {
        request.respond(base.iopubSocket, 'status', {
           execution_state: 'idle'
        });
    }



    beforeRun(base: any, request: any) {
        this.status_busy(base, request);

        base.executionCount++;

        request.respond(
            base.iopubSocket,
            "execute_input", {
                execution_count: base.executionCount,
                code: request.content.code,
            }
        );
    }

    afterRun(base: any, request: any ) {
        this.status_idle(base, request);
    }

    onSuccess(base: any, request: any, result: any) {
        request.respond(
            base.shellSocket,
            "execute_reply", {
                status: "ok",
                execution_count: base.executionCount,
                payload: [], // TODO(NR) not implemented,
                user_expressions: {}, // TODO(NR) not implemented,
            }
        );

        if (!result.mime) {
            return;
        }

        if (base.hideUndefined &&
            result.mime["text/plain"] === "undefined") {
            return;
        }

        request.respond(
            base.iopubSocket,
            "execute_result", {
                execution_count: base.executionCount,
                data: result.mime,
                metadata: {},
            }
        );
    }

    onError(base: any, request: any, result: any) {
        request.respond(
            base.shellSocket,
            "execute_reply", {
                status: "error",
                execution_count: base.executionCount,
                ename: result.error.ename,
                evalue: result.error.evalue,
                traceback: result.error.traceback,
            }
        );

        request.respond(
            base.iopubSocket,
            "error", {
                execution_count: base.executionCount,
                ename: result.error.ename,
                evalue: result.error.evalue,
                traceback: result.error.traceback,
            }
        );
    }
}
