var Service, Characteristic
const request = require('request')
const packageJson = require('./package.json')

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-http-garage-door-ultimate', 'HTTPGarageDoorUltimate', HTTPGarageDoorUltimate)
}

function HTTPGarageDoorUltimate (log, config) {
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
  
  this.openingTime = config.openingTime || 5
  this.closingTime = config.closingTime || 5
  this.openedTime = config.openedTime || 5

  if (this.username != null && this.password != null) {
    this.auth = {
      user: this.username,
      pass: this.password
    }
  }

  this.log(this.name)

  this.service = new Service.GarageDoorOpener(this.name)
}

HTTPGarageDoorUltimate.prototype = {

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

  setTargetDoorState: function (value, callback) {
    var url
    var body
    var headers
    this.log('[+] Setting TargetDoorState to %s', value)
    if (value === 1) {
      this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED)
      this.log('[*] Closed the garage door')

      callback()
      return
    } else {
      url = this.openURL
      body = this.openBody
      headers = this.openHeader
    }
    this._httpRequest(url, headers, body, this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log('[!] Error setting TargetDoorState: %s', error.message)
        callback(error)
      } else {
        if (value === 0) {
          this.log('[*] Opening the garage door')
          this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING)

          setTimeout(() => {
            this.service.getCharacteristic(Characteristic.CurrentDoorState).updateValue(Characteristic.CurrentDoorState.OPENED)
            this.log('[*] Garage Door State opened')
          }, (this.openingTime) * 1000)

          setTimeout(() => {
            this.service.getCharacteristic(Characteristic.CurrentDoorState).updateValue(Characteristic.CurrentDoorState.CLOSING)
            this.log('[*] Garage Door State closing')
          }, (this.openingTime + this.openedTime) * 1000)

          setTimeout(() => {
            this.service.getCharacteristic(Characteristic.CurrentDoorState).updateValue(Characteristic.CurrentDoorState.CLOSED)
            this.service.getCharacteristic(Characteristic.TargetDoorState).updateValue(1)
            this.log('[*] Garage Door State closed')
          }, (this.openingTime + this.openedTime + this.closingTime) * 1000)
        }
        callback()
      }
    }.bind(this))
  },

  getServices: function () {
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED)
    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED)
    this.service.setCharacteristic(Characteristic.ObstructionDetected, false)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    this.service
      .getCharacteristic(Characteristic.TargetDoorState)
      .on('set', this.setTargetDoorState.bind(this))

    return [this.informationService, this.service]
  }
}
