const socket = io("https://watch-together-backend-edll.onrender.com");

let roomId = "";

// 🎥 WebRTC
let peer;
let myStream;

// 🎬 YouTube
let player;
let isSyncing = false;

// =====================
// JOIN / LEAVE
// =====================

function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  if (!roomId) return alert("Enter Room ID");

  socket.emit("join-room", roomId);
  startVideoCall();
}

function leaveRoom() {
  if (myStream) {
    myStream.getTracks().forEach(track => track.stop());
  }

  if (peer) {
    peer.destroy();
    peer = null;
  }

  socket.emit("leave-room");

  document.getElementById("partnerVideo").srcObject = null;
  document.getElementById("myVideo").srcObject = null;
  document.getElementById("chat").innerHTML = "";

  if (player) {
    player.destroy();
    player = null;
  }

  roomId = "";
  alert("You left the room");
}

// =====================
// 🎬 YOUTUBE
// =====================

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    events: {
      onStateChange: onPlayerStateChange
    }
  });
}

function extractVideoId(url) {
  const regExp = /(?:youtube\.com.*v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function loadYouTube() {
  const url = document.getElementById("youtubeLink").value;
  const videoId = extractVideoId(url);

  if (!videoId) return alert("Invalid link");

  player.loadVideoById(videoId);

  socket.emit("youtube-load", { roomId, videoId });
}

function onPlayerStateChange(event) {
  if (isSyncing) return;

  const time = player.getCurrentTime();

  if (event.data === YT.PlayerState.PLAYING) {
    socket.emit("youtube-play", { roomId, time });
  }

  if (event.data === YT.PlayerState.PAUSED) {
    socket.emit("youtube-pause", { roomId });
  }
}

// 🔁 SEEK SYNC
setInterval(() => {
  if (!player) return;

  socket.emit("youtube-seek", {
    roomId,
    time: player.getCurrentTime()
  });
}, 2000);

// =====================
// SOCKET EVENTS
// =====================

socket.on("youtube-load", ({ videoId }) => {
  isSyncing = true;
  player.loadVideoById(videoId);
  setTimeout(() => isSyncing = false, 1000);
});

socket.on("youtube-play", (time) => {
  isSyncing = true;
  player.seekTo(time);
  player.playVideo();
  setTimeout(() => isSyncing = false, 500);
});

socket.on("youtube-pause", () => {
  isSyncing = true;
  player.pauseVideo();
  setTimeout(() => isSyncing = false, 500);
});

socket.on("youtube-seek", (time) => {
  isSyncing = true;
  player.seekTo(time);
  setTimeout(() => isSyncing = false, 500);
});

// =====================
// 💬 CHAT (UNCHANGED)
// =====================

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value;

  if (!msg.trim()) return;

  socket.emit("chat-message", { roomId, message: msg });
  addMessage(msg, true);

  input.value = "";
}

socket.on("chat-message", (msg) => addMessage(msg, false));

function addMessage(msg, isYou) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = `p-2 rounded-xl max-w-[70%] ${
    isYou ? "bg-pink-500 ml-auto" : "bg-gray-700"
  }`;
  div.textContent = msg;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById("messageInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// =====================
// 🎥 VIDEO CALL (UNCHANGED)
// =====================

async function startVideoCall() {
  peer = new Peer();

  myStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  document.getElementById("myVideo").srcObject = myStream;

  peer.on("open", (id) => {
    socket.emit("peer-id", { roomId, peerId: id });
  });

  socket.on("all-peer-ids", (peerIds) => {
    peerIds.forEach((id) => {
      if (id === peer.id) return;

      const call = peer.call(id, myStream);

      call.on("stream", (stream) => {
        const vid = document.getElementById("partnerVideo");
        vid.srcObject = stream;
      });
    });
  });

  peer.on("call", (call) => {
    call.answer(myStream);

    call.on("stream", (stream) => {
      const vid = document.getElementById("partnerVideo");
      vid.srcObject = stream;
    });
  });
}

// =====================
// 🎤 CONTROLS
// =====================

function toggleMic() {
  const track = myStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

function toggleCamera() {
  const track = myStream.getVideoTracks()[0];
  track.enabled = !track.enabled;
}
