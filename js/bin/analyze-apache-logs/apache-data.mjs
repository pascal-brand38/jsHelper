// Copyright (c) Pascal Brand
// MIT License
// @ts-ignore
import Alpine from 'alpine'; // Apache Log Parser
import * as fs from 'fs';
class ApacheData {
    constructor() {
        this.logs = [];
        this.ips = { all: [], user: [], bot: [], spam: [] };
    }
    /**
     * Read all log files, and populates this.logs
     * @param {Array.<string>} logFilenames
     */
    readLogs(logFilenames) {
        // Apache logs: https://httpd.apache.org/docs/current/mod/mod_log_config.html
        // On
        //    '78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"'
        // returns:
        //   {
        //     originalLine: '78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"',
        //     remoteHost: '78.153.241.205',
        //     logname: 'www.example.com',
        //     remoteUser: '-',
        //     time: '27/Dec/2021:05:55:01 +0100',
        //     request: 'GET /index.html HTTP/1.1',
        //     status: '200',
        //     sizeCLF: '3092',
        //     'RequestHeader Referer': '-',
        //     'RequestHeader User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0'
        //   }
        var alpine = new Alpine('%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-Agent}i"');
        // var logs = alpine.parseLine('78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"');
        // console.log(logs);
        let lines = [];
        logFilenames.forEach(logFilename => {
            const log = fs.readFileSync(logFilename).toString();
            lines = lines.concat(log.split('\n'));
        });
        this.logs = [];
        for (const line of lines) {
            if (line.length !== 0) {
                this.logs.push(alpine.parseLine(line));
            }
        }
    }
    /** return all logs related to an IP, excluding some of them that are in the JSON configuration */
    getLogsforIp(ip, config) {
        return this.logs.filter((log) => {
            if (log.remoteHost === ip) {
                // check for exclude
                return !Object.keys(log).some((key) => {
                    const exclude = config[key]?.exclude ?? [];
                    return exclude.some((e) => log[key].includes(e));
                });
            }
            else {
                return false;
            }
        });
    }
    // return 1 for user, 2 for bot, and 3 for spam
    categoriesIp(ip, logs, config) {
        let result = 1;
        if (logs.length === 0) {
            return 1; // this is a user, with the mail signature being addressed
        }
        if (logs.length <= 2) {
            // TODO: weak
            result = 2;
        }
        // same user-agent? if not, this is a spam => stop immediately
        // note different user-agent may occur when the user is looking with google and then with firefox, which may be rare enough
        const ua = logs[0]['RequestHeader User-Agent'];
        if (logs.some((l) => l['RequestHeader User-Agent'] !== ua)) {
            return 3; // a spam, so stop immediatly
        }
        if ((result === 1) && (config.request.routes && config.request.routes.length !== 0)) {
            // if no user route is used, then this is at least a bot
            if (!logs.some((l) => config.request.routes.some((route) => l['request'].includes(route)))) {
                result = 2;
            }
        }
        // check if it is a spam, using the config.xxx.spam
        if (logs.some(log => Object.keys(log).some((key) => {
            // console.log(key, log[key as keyof ApacheLineTypes])
            const spam = config[key]?.spam ?? [];
            return spam.some((e) => log[key].includes(e));
        }))) {
            return 3;
        }
        // check if it is a bot
        if ((result === 1) && (logs.some(log => Object.keys(log).some((key) => {
            const bot = config[key]?.bot ?? [];
            return bot.some((e) => log[key].includes(e));
        })))) {
            result = 2;
        }
        // special rules
        if (config.special) {
            if (config.special['get php files']) {
                // no /GET of php files, otherwise is a spam
                if (logs.some(log => {
                    const req = log.request.split(' ');
                    return ((req[0] === 'GET') && (req[1].endsWith('.php') || req[1].includes('.php?')));
                })) {
                    return 3;
                }
            }
        }
        return result;
    }
    /**
     * Populate ips, that is ips['all'], ips['user'], ips['bot'], and ips['spam']
     */
    populateIps(options) {
        const config = options.config;
        let setUnique = new Set(this.logs.map(function (a) { return a.remoteHost; }));
        this.ips['all'] = [...setUnique].sort();
        // array of 1, 2 or 3, 1 for user, 2 for bot, and 3 for spam
        this.ips['all'].forEach((ip) => {
            const logs = this.getLogsforIp(ip, config);
            const result = this.categoriesIp(ip, logs, config);
            switch (result) {
                case 1:
                    this.ips['user'].push(ip);
                    break;
                case 2:
                    this.ips['bot'].push(ip);
                    break;
                case 3:
                    this.ips['spam'].push(ip);
                    break;
            }
        });
    }
    print(options) {
        const config = options.config;
        if (!config.print) {
            return;
        }
        config.print.forEach((configPrint) => {
            const ipCategory = configPrint.ips ?? 'all';
            console.log(`\n- IPs category: ${ipCategory}`);
            console.log(configPrint);
            const ips = this.ips[ipCategory];
            if (!ips || ips.length === 0) {
                console.log('    (no IPs)');
                return;
            }
            const logs = this.logs.filter(l => ips.includes(l.remoteHost));
            const statusRequest = {};
            logs.forEach((log) => {
                if (configPrint.excludeStatus && configPrint.excludeStatus.includes(log.status)) {
                    // in the status exclude list ==> skip
                    return;
                }
                // if one key is not correct, then skip it
                if (Object.keys(log).some((key) => {
                    // return true to skip this log, and false to keep it
                    if (!configPrint[key]) {
                        // if no config for this key, then we don't filter on it
                        return false;
                    }
                    // return false if one of the configPrint[key] is in the log[key]
                    return !(configPrint[key].some((r) => {
                        if (r.startsWith('!')) {
                            // negative match
                            return !log[key].includes(r.substring(1));
                        }
                        else {
                            return log[key].includes(r);
                        }
                    }));
                })) {
                    return;
                }
                const status = log['status'];
                const request = log['request'];
                if (statusRequest[status] === undefined) {
                    statusRequest[status] = {};
                }
                if (statusRequest[status][request] === undefined) {
                    statusRequest[status][request] = 0;
                }
                statusRequest[status][request]++;
            });
            Object.keys(statusRequest).forEach(status => {
                console.log(`    Status ${status}:`);
                Object.keys(statusRequest[status]).forEach(request => {
                    console.log(`        #${statusRequest[status][request]}: ${request}`);
                });
            });
            console.log();
        });
    }
}
export default ApacheData;
