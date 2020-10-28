var Service, Characteristic
const request = require('request')
const packageJson = require('./package.json')

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-http-lock-ultimate', 'HTTPLockUltimate', HTTPLockUltimate)
}

function HTTPLockUltimate (log, config) {
  this.log = log

  this.name = config.name

  this.manufacturer = config.manufacturer || packageJson.author.name
  this.serial = config.serial || packageJson.version
  this.model = config.model || packageJson.name
  this.firmware = config.firmware || packageJson.version

  this.username = config.username || null
  this.password = config.password || null
  this.timeout = (config.timeout * 1000) || 5000
  this.http_method = config.http_method || 'GET'

  this.openURL = config.openURL
  this.openBody = config.openBody || ''
  this.openHeader = config.openHeader || null
  this.closeURL = config.closeURL
  this.closeBody = config.closeBody || ''
  this.closeHeader = config.closeHeader || null

  this.autoLock = config.autoLock || false
  this.autoLockDelay = config.autoLockDelay || 5
  
  this.resetLock = config.resetLock || false
  this.resetLockTime = config.resetLockTime || 5

  if (this.username != null && this.password != null) {
    this.auth = {
      user: this.username,
      pass: this.password
    }
  }

  this.log(this.name)

  this.service = new Service.LockMechanism(this.name)
}

HTTPLockUltimate.prototype = {

  identify: function (callback) {
    this.log('Identify requested!')
    callback()
  },

  _httpRequest: function (url, headers, body, method, callback) {
    request({
      url: url,
      headers: headers,
      body: body,
      method: this.http_method,
      timeout: this.timeout,
      rejectUnauthorized: false,
      auth: this.auth
    },
    function (error, response, body) {
      callback(error, response, body)
    })
  },

  setLockTargetState: function (value, callback) {
    var url
    var body
    var headers
    this.log('[+] Setting LockTargetState to %s', value)
    if (value === 1) {
      url = this.closeURL
      body = this.closeBody
      headers = this.closeHeader
    } else {
      url = this.openURL
      body = this.openBody
      headers = this.openHeader
    }
    this._httpRequest(url, headers, body, this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log('[!] Error setting LockTargetState: %s', error.message)
        callback(error)
      } else {
        if (value === 1) {
          this.service.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED)
          this.log('[*] Closed the lock')
        } else {
          this.log('[*] Opened the lock')
          this.service.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED)
          if (this.autoLock) {
            this.autoLockFunction()
          }
		  else if (this.resetLock) {
			  this.resetLockFunction()
		  }
        }
        callback()
      }
    }.bind(this))
  },

  autoLockFunction: function () {
    this.log('[+] Waiting %s seconds for autolock', this.autoLockDelay)
    setTimeout(() => {
      this.service.setCharacteristic(Characteristic.LockTargetState, Characteristic.LockTargetState.SECURED)
      this.log('[*] Autolocking')
    }, this.autoLockDelay * 1000)
  },
  
  resetLockFunction: function () {
    this.log('[+] Waiting %s seconds for resetting lock state to locked', this.resetLockTime)
    setTimeout(() => {
      /*this.service.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED)*/
	  this.service.getCharacteristic(Characteristic.LockCurrentState).updateValue(1)
	  this.service.getCharacteristic(Characteristic.LockTargetState).updateValue(1)
	  console.log(this.service);
      this.log('[*] Lock State resetted')
    }, this.resetLockTime * 1000)
  },

  getServices: function () {
    this.service.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED)
    this.service.setCharacteristic(Characteristic.LockTargetState, Characteristic.LockTargetState.SECURED)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    this.service
      .getCharacteristic(Characteristic.LockTargetState)
      .on('set', this.setLockTargetState.bind(this))

    return [this.informationService, this.service]
  }
}
