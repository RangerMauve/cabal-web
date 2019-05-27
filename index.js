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

// This discovery server supports the default handshaking from discovery-swarm which is needed for cabal
const DISCOVERY_SERVER = 'wss://rawswarm.mauve.moe'

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
    discovery: DISCOVERY_SERVER,
    id: Buffer.from(key)
  })

  swarm.join(joinKey)
})

let currentChannel = null

loadChannel('default')

$('#controls').addEventListener('submit', (e) => {
  e.preventDefault()
  const messageInput = $('#message')

  const message = messageInput.value
  if(!message) return

  messageInput.value = ''

  writeMessage(message)
})

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

function writeMessage(text) {
  if(text.startsWith('/nick')) {
    const nick = text.slice('/nick '.length)
    cabal.publishNick(nick)
    return
  }

  cabal.publish({
    type: 'chat/text',
    content: {
      text,
      channel: currentChannel
    }
  })
}

function addMessage({key, seq, value}, prepend) {
  const {content, type, timestamp} = value
  const {channel, text} = content

  // Don't show messages from other channels
  if(channel !== currentChannel) return

  cabal.getUser(key, (err, user) => {
    let name = `Anon-${key.slice(0,8)}`
    if(user) name = user.name
    console.log(timestamp, name, text)
    const contents = `
      <span class="message-timestamp">${prettyTimestamp(timestamp)}</span>
      <span class="message-author">${name}</span>:
      <span class="message-text">${text}</span>
    `

    const item = document.createElement('div')
    item.classList.add('message')

    item.innerHTML = contents
    if(prepend) {
      $('#messages').insertBefore(item, $('#messages').firstChild)
    } else {
      $('#messages').appendChild(item)
    }
  })
}

function loadChannel(channel) {
  if(currentChannel) {
    cabal.messages.events.removeListener(currentChannel, addMessage)
  }

  currentChannel = channel

  $('#messages').innerHTML = `<div>Loading channel ${channel}</div>`

  // Read messages
  cabal.messages.read(channel, {
    limit: 16,
  })
  // Render the latest 16
  .on('data', (message) => {
    addMessage(message, true)
  })
  // Start listening for new messages
  .on('end', () => {
    cabal.messages.events.on(channel, addMessage)
  })
}

function prettyTimestamp(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = zeropad(date.getMonth()+1)
  const day = zeropad(date.getDate())
  const hours = zeropad(date.getHours())
  const minutes= zeropad(date.getMinutes())
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

function zeropad(number) {
  if(number < 10) {
    return `0${number}`
  }
  return number
}

function $(selector) {
  return document.querySelector(selector)
}

function sha1 (id) {
  return crypto.createHash('sha1').update(id).digest()
}
