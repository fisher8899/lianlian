<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const myId = ref('正在获取...')
const remoteId = ref('')
const isConnecting = ref(false)
const isConnected = ref(false)
const connectionStatus = ref('未连接')
const logs = ref<string[]>([])

// 视频相关
const localStream = ref<MediaStream | null>(null)
const remoteStream = ref<MediaStream | null>(null)
const isSharing = ref(false)
const remoteVideo = ref<HTMLVideoElement | null>(null)
const remoteScreenSize = ref({ width: 1920, height: 1080 }) // 默认，实际应交换

let socket: WebSocket | null = null
let peerConnection: RTCPeerConnection | null = null
let dataChannel: RTCDataChannel | null = null

const log = (msg: string) => {
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`)
  if (logs.value.length > 50) logs.value.pop()
  console.log(msg)
}

// 1. 获取屏幕流 (被控端)
const startScreenShare = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always", frameRate: 30 },
      audio: false
    })
    localStream.value = stream
    isSharing.value = true
    
    // 获取屏幕分辨率并保存，以便发送给主控端
    const track = stream.getVideoTracks()[0]
    const settings = track.getSettings()
    log(`屏幕分辨率: ${settings.width}x${settings.height}`)
    
    // 发送分辨率给对方 (如果已连接)
    if (dataChannel?.readyState === 'open') {
      sendControlMeta(settings.width || 1920, settings.height || 1080)
    }

    track.onended = () => {
      isSharing.value = false
      localStream.value = null
    }
  } catch (e) {
    log(`获取屏幕失败: ${e}`)
  }
}

// 2. 初始化信令
const initSignal = () => {
  socket = new WebSocket('ws://localhost:9001')
  socket.onopen = () => { isConnecting.value = false; log('信令已连接') }
  socket.onclose = () => { myId.value = '离线' }
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data)
    if (data.from && !remoteId.value) remoteId.value = data.from
    switch (data.type) {
      case 'welcome': myId.value = data.id; break
      case 'offer': handleOffer(data); break
      case 'answer': handleAnswer(data); break
      case 'candidate': handleCandidate(data); break
    }
  }
}

// 3. 创建 PeerConnection
const createPeerConnection = () => {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })

  if (localStream.value) {
    localStream.value.getTracks().forEach(track => pc.addTrack(track, localStream.value!))
  }

  pc.ontrack = (event) => {
    log('收到远程视频流')
    if (event.streams && event.streams[0]) {
      remoteStream.value = event.streams[0]
      setTimeout(() => {
        if (remoteVideo.value) remoteVideo.value.srcObject = event.streams[0]
      }, 100)
    }
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && remoteId.value) {
      sendSignal({ type: 'candidate', candidate: event.candidate, target: remoteId.value })
    }
  }

  pc.onconnectionstatechange = () => {
    connectionStatus.value = pc.connectionState
    if (pc.connectionState === 'connected') {
      isConnected.value = true
      isConnecting.value = false
    }
  }

  pc.ondatachannel = (event) => setupDataChannel(event.channel)

  return pc
}

const setupDataChannel = (channel: RTCDataChannel) => {
  dataChannel = channel
  channel.onopen = () => {
    log('数据通道打开')
    // 如果是被控端，发送分辨率
    if (localStream.value) {
      const track = localStream.value.getVideoTracks()[0]
      const s = track.getSettings()
      sendControlMeta(s.width || 1920, s.height || 1080)
    }
  }
  
  channel.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'control') {
        // 调用 Rust 执行控制
        // 注意：这里需要根据分辨率映射坐标，但为了简化，直接透传
        // 假设 Rust 端处理绝对坐标
        await invoke('remote_control', { payload: JSON.stringify(msg.data) })
      } else if (msg.type === 'meta') {
        remoteScreenSize.value = { width: msg.width, height: msg.height }
        log(`对方屏幕分辨率: ${msg.width}x${msg.height}`)
      } else {
        log(`收到消息: ${e.data}`)
      }
    } catch (err) {
      // log(`非JSON消息: ${e.data}`)
    }
  }
}

const sendControlMeta = (w: number, h: number) => {
  dataChannel?.send(JSON.stringify({ type: 'meta', width: w, height: h }))
}

const sendSignal = (msg: any) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
}

const connect = async () => {
  if (!remoteId.value) return alert('请输入对方ID')
  isConnecting.value = true
  peerConnection = createPeerConnection()
  const channel = peerConnection.createDataChannel('control')
  setupDataChannel(channel)
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  sendSignal({ type: 'offer', sdp: offer, target: remoteId.value })
}

const handleOffer = async (data: any) => {
  remoteId.value = data.from
  peerConnection = createPeerConnection()
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  sendSignal({ type: 'answer', sdp: answer, target: data.from })
}

const handleAnswer = async (data: any) => {
  await peerConnection?.setRemoteDescription(new RTCSessionDescription(data.sdp))
}

const handleCandidate = async (data: any) => {
  if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
}

// 鼠标控制逻辑
const handleMouseMove = (e: MouseEvent) => {
  if (!dataChannel || dataChannel.readyState !== 'open') return
  if (!remoteVideo.value) return

  const rect = remoteVideo.value.getBoundingClientRect()
  
  // 归一化坐标 (0.0 - 1.0)
  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height

  // 映射到远程屏幕分辨率
  const targetX = Math.round(xRatio * remoteScreenSize.value.width)
  const targetY = Math.round(yRatio * remoteScreenSize.value.height)

  dataChannel.send(JSON.stringify({
    type: 'control',
    data: {
      type: 'mousemove', // Rust使用 mousemove
      x: targetX,
      y: targetY
    }
  }))
}

const handleMouseDown = (e: MouseEvent) => {
  if (!dataChannel || dataChannel.readyState !== 'open') return
  const btn = e.button === 2 ? 'right' : 'left'
  dataChannel.send(JSON.stringify({
    type: 'control',
    data: { type: 'mousedown', button: btn }
  }))
}

const handleMouseUp = (e: MouseEvent) => {
  if (!dataChannel || dataChannel.readyState !== 'open') return
  const btn = e.button === 2 ? 'right' : 'left'
  dataChannel.send(JSON.stringify({
    type: 'control',
    data: { type: 'mouseup', button: btn }
  }))
}

// 禁用右键菜单
const preventContext = (e: Event) => e.preventDefault()

onMounted(() => {
  initSignal()
})
</script>

<template>
  <div class="app-container">
    <header v-if="!remoteStream">
      <h1>连连 (LianLian)</h1>
      <span class="badge" :class="{ online: myId !== '离线' }">{{ myId }}</span>
    </header>

    <main>
      <!-- 全屏远程控制 -->
      <div class="remote-view" v-if="remoteStream">
        <div class="toolbar">
          控制中: {{ remoteId }}
          <button @click="remoteStream = null">断开</button>
        </div>
        <div class="video-container" 
             @mousemove="handleMouseMove" 
             @mousedown="handleMouseDown" 
             @mouseup="handleMouseUp"
             @contextmenu="preventContext">
          <video ref="remoteVideo" autoplay playsinline></video>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="controls-wrapper" v-else>
        <!-- 被控端 -->
        <div class="card host-card">
          <h2>被控模式</h2>
          <div class="code-box">本机ID: <strong>{{ myId }}</strong></div>
          <button @click="startScreenShare" :disabled="isSharing" class="share-btn" :class="{ active: isSharing }">
            {{ isSharing ? '正在共享...' : '开启共享' }}
          </button>
        </div>

        <!-- 主控端 -->
        <div class="card client-card">
          <h2>主控模式</h2>
          <input v-model="remoteId" placeholder="伙伴ID" />
          <button @click="connect" :disabled="isConnecting" class="connect-btn">连接</button>
        </div>
      </div>

      <div class="logs-panel" v-if="!remoteStream">
        <div v-for="(msg, i) in logs" :key="i">{{ msg }}</div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container { max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
.remote-view { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: black; z-index: 100; display: flex; flex-direction: column; }
.toolbar { padding: 10px; background: #2c3e50; color: white; display: flex; justify-content: space-between; }
.video-container { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: none; /* 隐藏本地鼠标，模拟远程 */ }
video { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }

.controls-wrapper { display: flex; gap: 20px; margin-top: 20px; }
.card { flex: 1; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background: #f9f9f9; }
.share-btn, .connect-btn { width: 100%; padding: 10px; margin-top: 10px; cursor: pointer; }
.share-btn.active { background: #27ae60; color: white; }
.logs-panel { margin-top: 20px; height: 100px; overflow-y: auto; background: #333; color: #ccc; font-size: 12px; padding: 10px; }
</style>
