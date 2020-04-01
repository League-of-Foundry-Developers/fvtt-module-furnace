"use strict";

const MODE_NONE = 'modeNone';
const MODE_DEFAULT = 'modeDefault';
const MODE_MATCH = 'modeMatch';

/**
 * Sorts the tokenizable substrings by their length DESC.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const sortTokenizableSubstrings = (a, b) => {

    if (a.length > b.length) {
        return -1;
    }
    if (a.length < b.length) {
        return 1;
    }
    return 0;
};

const endsWith = (str, suffix) => {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

/**
 * Create an instance of this class for each new string you wish to parse.
 */
class Tokenizer {

    /**
     *
     * @param {TokenizeThis} factory
     * @param {string} str
     * @param {function} forEachToken
     */
    constructor(factory, str, forEachToken) {

        /**
         * Holds the processed configuration.
         *
         * @type {TokenizeThis}
         */
        this.factory = factory;

        /**
         * The string to tokenize.
         *
         * @type {string}
         */
        this.str = str;

        /**
         * The function to call for teach token.
         *
         * @type {Function}
         */
        this.forEachToken = forEachToken;

        /**
         * The previous character consumed.
         *
         * @type {string}
         */
        this.previousChr = '';

        /**
         * The current quote to match.
         *
         * @type {string}
         */
        this.toMatch = '';

        /**
         * The current token being created.
         *
         * @type {string}
         */
        this.currentToken = '';

        /**
         * Keeps track of the current "mode" of tokenization.
         * The tokenization rules are different depending if you are tokenizing an explicit string (surrounded by quotes),
         * versus a non-explicit string (not surrounded by quotes).
         *
         * @type {*[]}
         */
        this.modeStack = [MODE_NONE];

        this.currentIndex = 0;
    }

    /**
     *
     * @returns {string}
     */
    getCurrentMode() {

        return this.modeStack[this.modeStack.length - 1];
    }

    /**
     *
     * @param {string} mode
     * @returns {Number}
     */
    setCurrentMode(mode) {

        return this.modeStack.push(mode);
    }

    /**
     *
     * @returns {string}
     */
    completeCurrentMode() {

        const currentMode = this.getCurrentMode();

        if (currentMode === MODE_DEFAULT) {
            this.pushDefaultModeTokenizables();
        }

        /**
         * Don't push out empty tokens, unless they were an explicit string, e.g. ""
         */
        if ((currentMode === MODE_MATCH && this.currentToken === '') || this.currentToken !== '') {
            this.push(this.currentToken);
        }
        this.currentToken = '';

        return this.modeStack.pop();
    }

    /**
     *
     * @param {*} token
     */
    push(token) {

        let surroundedBy = '';

        if (this.factory.convertLiterals && this.getCurrentMode() !== MODE_MATCH) {

            /**
             * Convert the string version of literals into their...literal..form.
             */
            switch(token.toLowerCase()) {
                case 'null':
                    token = null;
                    break;
                case 'true':
                    token = true;
                    break;
                case 'false':
                    token = false;
                    break;
                default:
                    if (isFinite(token)) {
                        token = Number(token);
                    }
                    break;
            }
        } else {

            /**
             * The purpose of also transmitting the surroundedBy quote is to inform whether or not the token was an explicit string,
             * versus a non-explicit string, e.g. "=" vs. =
             * @type {string}
             */
            surroundedBy = this.toMatch;
        }

        if (this.forEachToken) {
            this.forEachToken(token, surroundedBy, this.currentIndex);
        }
    }

    tokenize() {

        let index = 0;

        while(index < this.str.length) {

            this.currentIndex = index;
            this.consume(this.str.charAt(index++));
        }

        while (this.getCurrentMode() !== MODE_NONE) {

            this.completeCurrentMode();
        }
    }

    /**
     *
     * @param {string} chr
     */
    consume(chr) {

        this[this.getCurrentMode()](chr);
        this.previousChr = chr;
    }

    /**
     *
     * @param {string} chr
     * @returns {*}
     */
    [MODE_NONE](chr) {

        if (!this.factory.matchMap[chr]) {

            this.setCurrentMode(MODE_DEFAULT);
            return this.consume(chr);
        }

        this.setCurrentMode(MODE_MATCH);
        this.toMatch = chr;
    }

    /**
     *
     * @param {string} chr
     * @returns {string}
     */
    [MODE_DEFAULT](chr) {

        /**
         * If we encounter a delimiter, its time to push out the current token.
         */
        if (this.factory.delimiterMap[chr]) {

            return this.completeCurrentMode();
        }

        /**
         * If we encounter a quote, only push out the current token if there's a sub-token directly before it.
         */
        if (this.factory.matchMap[chr]) {

            let tokenizeIndex = 0;

            while (tokenizeIndex < this.factory.tokenizeList.length) {

                if (endsWith(this.currentToken, this.factory.tokenizeList[tokenizeIndex++])) {
                    this.completeCurrentMode();
                    return this.consume(chr);
                }
            }
        }

        this.currentToken+=chr;

        return this.currentToken;
    }

    /**
     * This crazy function parses out potential tokenizable substrings out of the current token.
     *
     * @returns {*}
     */
    pushDefaultModeTokenizables() {

        // TODO: refactor this to be more performant.

        let tokenizeIndex = 0;
        let lowestIndexOfTokenize = Infinity;
        let toTokenize = null;

        /**
         * Iterate through the list of tokenizable substrings.
         */
        while(this.currentToken && tokenizeIndex < this.factory.tokenizeList.length) {

            const tokenize = this.factory.tokenizeList[tokenizeIndex++];
            const indexOfTokenize = this.currentToken.indexOf(tokenize);

            /**
             * Find the substring closest to the beginning of the current token.
             */
            if (indexOfTokenize !== -1 && indexOfTokenize < lowestIndexOfTokenize) {

                lowestIndexOfTokenize = indexOfTokenize;
                toTokenize = tokenize;
            }
        }

        /**
         * No substrings to tokenize.  You're done.
         */
        if (!toTokenize) {
            return;
        }

        /**
         * A substring was found, but not at the very beginning of the string, e.g. A=B, where "=" is the substring.
         * This will push out "A" first.
         */
        if (lowestIndexOfTokenize > 0) {
            this.push(this.currentToken.substring(0, lowestIndexOfTokenize));
        }

        /**
         * Push out the substring, then modify the current token to be everything past that substring.
         * Recursively call this function again until there are no more substrings to tokenize.
         */
        if (lowestIndexOfTokenize !== -1) {

            this.push(toTokenize);
            this.currentToken = this.currentToken.substring(lowestIndexOfTokenize + toTokenize.length);
            return this.pushDefaultModeTokenizables();
        }
    }

    /**
     *
     * @param {string} chr
     * @returns {string}
     */
    [MODE_MATCH](chr) {

        if (chr === this.toMatch) {

            if (this.previousChr !== this.factory.escapeCharacter) {

                return this.completeCurrentMode();
            }
            this.currentToken = this.currentToken.substring(0, this.currentToken.length - 1);
        }

        this.currentToken+=chr;

        return this.currentToken;
    }
}

/**
 * This is the main class.  It takes in the config, processes it, and creates tokenizer instances based on that config.
 */
class TokenizeThis {

    /**
     *
     * @param {{shouldTokenize: string[], shouldMatch: string[], shouldDelimitBy: string[]}} [config]
     */
    constructor(config) {

        if (!config) {
            config = {};
        }

        /**
         *
         * @type {{shouldTokenize: string[], shouldMatch: string[], shouldDelimitBy: string[], convertLiterals: boolean, escapeCharacter: string}}
         */
        config = Object.assign({}, this.constructor.defaultConfig, config);

        /**
         *
         * @type {boolean}
         */
        this.convertLiterals = config.convertLiterals;

        /**
         *
         * @type {string}
         */
        this.escapeCharacter = config.escapeCharacter;

        /**
         * Holds the list of tokenizable substrings.
         *
         * @type {Array}
         */
        this.tokenizeList = [];

        /**
         * Holds an easy lookup map of tokenizable substrings.
         *
         * @type {{}}
         */
        this.tokenizeMap = {};

        /**
         * Holds the list of quotes to match explicit strings with.
         *
         * @type {Array}
         */
        this.matchList = [];

        /**
         * Holds an easy lookup map of quotes to match explicit strings with.
         *
         * @type {{}}
         */
        this.matchMap = {};

        /**
         * Holds the list of delimiters.
         *
         * @type {Array}
         */
        this.delimiterList = [];

        /**
         * Holds an easy lookup map of delimiters.
         *
         * @type {{}}
         */
        this.delimiterMap = {};

        /**
         * Sorts the tokenizable substrings based on their length,
         * such that "<=" will get matched before "<" does.
         */
        config.shouldTokenize.sort(sortTokenizableSubstrings).forEach((token) => {

            if (!this.tokenizeMap[token]) {
                this.tokenizeList.push(token);
                this.tokenizeMap[token] = token;
            }
        });

        config.shouldMatch.forEach((match) => {

            if (!this.matchMap[match]) {
                this.matchList.push(match);
                this.matchMap[match] = match;
            }
        });

        config.shouldDelimitBy.forEach((delimiter) => {

            if (!this.delimiterMap[delimiter]) {
                this.delimiterList.push(delimiter);
                this.delimiterMap[delimiter] = delimiter;
            }
        });
    }

    /**
     * Creates a Tokenizer, then immediately calls "tokenize".
     *
     * @param {string} str
     * @param {function} forEachToken
     * @returns {*}
     */
    tokenize(str, forEachToken) {

        const tokenizerInstance = new Tokenizer(this, str, forEachToken);
        return tokenizerInstance.tokenize();
    }

    /**
     *
     * @returns {{shouldTokenize: string[], shouldMatch: string[], shouldDelimitBy: string[], convertLiterals: boolean, escapeCharacter: string}}
     */
    static get defaultConfig() {

        return {
            shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '-', '=', '!=', '!', '<', '>', '<=', '>=', '^'],
            shouldMatch: ['"', "'", '`'],
            shouldDelimitBy: [' ', "\n", "\r", "\t"],
            convertLiterals: true,
            escapeCharacter: "\\"
        };
    }
}

/**
 *
 * @type {TokenizeThis}
 */
module.exports = TokenizeThis;
