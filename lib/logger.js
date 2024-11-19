
class Logger {
    static LOG_LEVELS = {
        VERBOSE: 0,
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4,
        NONE: 5
    };

    constructor() {
        this.currentLevel = Logger.LOG_LEVELS.VERBOSE;
        this.includedFiles = null;  // null means all files
        this.excludedFiles = new Set();
        this.colors = {
            VERBOSE: '\x1b[90m',  // gray
            DEBUG: '\x1b[36m',    // cyan
            INFO: '\x1b[32m',     // green
            WARN: '\x1b[33m',     // yellow
            ERROR: '\x1b[31m',    // red
            RESET: '\x1b[0m'
        };
    }

    parseStack() {
        // Stack levels:
        // [0] - Error constructor
        // [1] - parseStack
        // [2] - log method (verbose/debug/info/etc)
        // [3] - caller of log method
        const stack = new Error().stack.split('\n')[4];  // Changed from 3 to 4
        const regex = /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))/;
        const match = regex.exec(stack);
        if (!match) return { func: 'unknown', file: 'unknown', line: '0' };

        const [, func = 'anonymous', file, line] = match;
        const fileName = file.split('/').pop();
        return { func, fileName, line };
    }

    setLevel(level) {
        if (level in Logger.LOG_LEVELS) {
            this.currentLevel = Logger.LOG_LEVELS[level];
        }
    }

    includeFiles(files) {
        this.includedFiles = new Set(files);
    }

    excludeFiles(files) {
        this.excludedFiles = new Set(files);
    }

    shouldLog(fileName, level) {
        if (Logger.LOG_LEVELS[level] < this.currentLevel) return false;
        if (this.excludedFiles.has(fileName)) return false;
        if (this.includedFiles && !this.includedFiles.has(fileName)) return false;
        return true;
    }

    log(level, ...args) {
        const { func, fileName, line } = this.parseStack();
        
        if (!this.shouldLog(fileName, level)) return;

        const timestamp = new Date().toISOString();
        const color = this.colors[level];
        const levelStr = ["VERBOSE", "DEBUG", "INFO", "WARN", "ERROR"][level];
        const prefix = `${timestamp} [${fileName}(L${line})::${func}()::${levelStr}]`;
        
        console.log(/*color, */prefix, ...args/*, this.colors.RESET*/); // color not working
    }

    ddir(obj) { this._dir(obj, null); }

    dir(obj) { this._dir(obj, 1); }

    _dir(obj, deep) {
        const { func, fileName, line } = this.parseStack();
        if (!this.shouldLog(fileName, Logger.LOG_LEVELS.DEBUG)) return;

        console.dir(obj, { depth: deep, colors: true });
    }

    verbose(...args) { this.log(Logger.LOG_LEVELS.VERBOSE, ...args); }
    debug(...args) { this.log(Logger.LOG_LEVELS.DEBUG, ...args); }
    info(...args) { this.log(Logger.LOG_LEVELS.INFO, ...args); }
    warn(...args) { this.log(Logger.LOG_LEVELS.WARN, ...args); }
    error(...args) { this.log(Logger.LOG_LEVELS.ERROR, ...args); }
}

// Create and export singleton instance
module.exports = new Logger();
