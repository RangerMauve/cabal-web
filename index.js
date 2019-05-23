const url = new URL(window.location.href)

let key = url.searchParams.get('key')

if(!key) {
  const gotKey = prompt("Enter a cabal key to join", 'cabal://14bc77d788fdaf07b89b28e9d276e47f2e44011f4adb981921056e1b3b40e99e')

  window.location.search = `?key=${gotKey}`
}

if(key.startsWith('cabal://')) {
  key = key.slice('cabal://'.length)
}

key = Buffer.from(key, 'hex')

const Cabal = require('cabal-core')
const crypto = require('crypto')
const RAW = require('random-access-web')
const DiscoverySwarmWeb = require('discovery-swarm-web')

const storage = RAW('cabal')
const cabalStorage = (file) => storage(key + '/' + file)

const cabal = new Cabal(cabalStorage, key)

window.loadChannel = loadChannel

cabal.channels.events.on('add', renderChannels)

cabal.getLocalKey((err, key) => {
  if(err) throw err

  const joinKey = sha1(cabal.key.toString('hex')).slice(0, 20)

  console.log('joinKey', joinKey.toString('hex'))

  const swarm = new DiscoverySwarmWeb({
    stream,
    id: Buffer.from(key)
  })

  swarm.join(joinKey)
})

let currentChannel = null

loadChannel('default')

function renderChannels() {
  cabal.channels.get((err, channels) => {
    const contents = channels.map((channel) => `
      <button class="channel-item" onclick="loadChannel('${channel}')">${channel}</button>
    `).join('\n')

    $('#channels').innerHTML = contents
  })
}

function stream(info) {
  console.log('Replicating', info)
  return cabal.replicate()
}

function addMessage(message) {
  console.log(message)
}

function loadChannel(channel) {
  if(currentChannel) {
    cabal.messages.events.removeListener(currentChannel, addMessage)
  }

  currentChannel = channel

  $('#messages').innerHTML = `<div>Loading channel ${channel}</div>`

  cabal.messages.read(channel, {
    limit: 16
  }).on('data', addMessage)

  cabal.messages.events.on(channel, addMessage)
}

function $(selector) {
  return document.querySelector(selector)
}

function sha1 (id) {
  return crypto.createHash('sha1').update(id).digest()
}
