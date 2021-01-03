/**
 * Copyright 2015 Sorin Chitu.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var DIRECTION_GPIO = 0x00,
    FROM_GPIO = 0x09,
    TO_GPIO = 0x0A,
    i2c = require('i2c-bus'),
    i2c1;

var MCP23008 = (function() {
    MCP23008.prototype.HIGH = 1;
    MCP23008.prototype.LOW = 0;
    MCP23008.prototype.INPUT = 1;
    MCP23008.prototype.OUTPUT = 0;

    MCP23008.prototype.address = 0x20; //if the mcp has all adress lines pulled low
    MCP23008.prototype.oldDir = 0xff; //initial state of GPIO A
    MCP23008.prototype.oldGpio = 0x0; //initial state of GPIO A


    function MCP23008(config) {
        if (config.reverse) {
            this.HIGH = 0;
            this.LOW = 1;
        }
        this.address = config.address;
        this.mode = this.INPUT;
        this.debug = config.debug === true ? true : false;
        this.bus = config.bus !== null ? config.bus : 1;
        this.i2c1 = i2c.open(this.bus, function (err) {
            if (err) {
                console.error(err);
            }
        });
        this._initGpio();
    }

    //inits both registers as an input
    MCP23008.prototype.reset = function() {
        this.oldDir = 0xff;
        this._initGpio();;
    };

    /*
      sets an pin as an INPUT or OUTPUT
    */
    MCP23008.prototype.pinMode = function(pin, dir) {
        if (dir !== this.INPUT && dir !== this.OUTPUT) {
            console.error('invalid value', dir);
            return;
        }
        if (isNaN(pin)) {
            console.error('pin is not a number:', pin);
            return;
        } else if (pin > 15 || pin < 0) {
            console.error('invalid pin:', pin);
        }

        //delegate to funktion that handles low level stuff
        this._setGpioDir(pin, dir, DIRECTION_GPIO);
    };

    /*
      internally used to set the direction registers
    */
    MCP23008.prototype._setGpioDir = function(pin, dir, register) {
        var pinHexMask = Math.pow(2, pin),
            registerValue;

        if (register === DIRECTION_GPIO) {
            registerValue = this.oldDir;
            if (dir === this.OUTPUT) {
                if ((this.oldDir & pinHexMask) === pinHexMask) {
                    this.log('setting pin \'' + pin + '\' as an OUTPUT');
                    this.oldDir = this.oldDir ^ pinHexMask;
                    registerValue = this.oldDir;
                } else {
                    this.log('pin \'' + pin + '\' already an OUTPUT');
                }
            } else if (dir === this.INPUT) {
                if ((this.oldDir & pinHexMask) !== pinHexMask) {
                    this.log('setting pin \'' + pin + '\' as an INPUT');
                    this.oldDir = this.oldDir ^ pinHexMask;
                    registerValue = this.oldDir;
                } else {
                    this.log('pin \'' + pin + '\' already an INPUT');
                }
            }
        }
        this._send(register, registerValue);
        this.log('register: ' + register + ', value: ' + registerValue);
    };

    MCP23008.prototype._setGpioPinValue = function(pin, value) {
        var pinHexMask = Math.pow(2, pin);
        if (value === 0) {
            if ((this.oldGpio & pinHexMask) === pinHexMask) {
                this.oldGpio = this.oldGpio ^ pinHexMask;
                this._send(TO_GPIO, this.oldGpio);
            }
        }
        if (value === 1) {
            if ((this.oldGpio & pinHexMask) !== pinHexMask) {
                this.oldGpio = this.oldGpio ^ pinHexMask;
                this._send(TO_GPIO, this.oldGpio);
            }
        }
    };

    var allowedValues = [0, 1, true, false];
    MCP23008.prototype.digitalWrite = function(pin, value) {
        if (allowedValues.indexOf(value) < 0) {
            console.error('invalid value', value);
            return;
        } else if (value === false) {
            value = this.LOW;
        } else if (value === true) {
            value = this.HIGH;
        }

        if (isNaN(pin)) {
            console.error('pin is not a number:', pin);
            return;
        } else if (pin > 7 || pin < 0) {
            console.error('invalid pin:', pin);
        } else {
            this._setGpioPinValue(pin, value);
        }
    };

    MCP23008.prototype.digitalRead = function(pin, callback) {
        var pinHexMask = Math.pow(2, pin); //create a hexMask

        //read one byte from the right register (A or B)
        this._read(FROM_GPIO, function(err, registerValue) {
            if (err) {
                console.error(err);
                callback(err, null);
            } else if ((registerValue & pinHexMask) === pinHexMask) {
                //Check if the requested bit is set in the byte returned from the register
                callback(null, true);
            } else {
                callback(null, false);
            }
        });

    };

    MCP23008.prototype._initGpio = function() {
        this._send(DIRECTION_GPIO, this.oldDir); //Set Direction to Output
        this._send(TO_GPIO, 0x0); //clear all output states
    };


    MCP23008.prototype._send = function(cmd, value) {
        this.i2c1.writeByte(this.address, cmd, value, function(err) {
            if (err) {
                console.error(err);
            }
        });
    };

    MCP23008.prototype._read = function(cmd, callback) {
        this.i2c1.readByte(this.address, cmd, function(err, res) {
            if (err) {
                console.error(err);
                callback(err, null);
            } else {
                callback(null, res);
            }
        });
    };

    MCP23008.prototype.log = function(msg) {
        if (this.debug) {
            console.log(msg);
        }
    };

    return MCP23008;

})();

module.exports = MCP23008;