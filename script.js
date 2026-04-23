const socket = io();

const roomId = "room1"; // you can make dynamic later
socket.emit("join-room", roomId);

let player;
let isSyncing = false;

// 🔹 Load YouTube Player
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        height: "360",
        width: "640",
        events: {
            onStateChange: onPlayerStateChange
        }
    });
}

// 🔹 Extract Video ID
function getVideoId(url) {
    let regExp = /(?:youtube\.com.*v=|youtu\.be\/)([^&]+)/;
    let match = url.match(regExp);
    return match ? match[1] : null;
}

// 🔹 Load Video
function loadVideo() {
    let url = document.getElementById("youtubeUrl").value;
    let id = getVideoId(url);

    if (id) {
        player.loadVideoById(id);
        socket.emit("load-video", id);
    }
}

// 🔹 Sync Play/Pause
function onPlayerStateChange(event) {
    if (isSyncing) return;

    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit("play");
    }

    if (event.data === YT.PlayerState.PAUSED) {
        socket.emit("pause");
    }
}

// 🔹 Seek Sync (every 2 sec)
setInterval(() => {
    if (!player) return;

    let time = player.getCurrentTime();
    socket.emit("seek", time);
}, 2000);

// 🔹 Receive Events

socket.on("load-video", (id) => {
    isSyncing = true;
    player.loadVideoById(id);
    setTimeout(() => isSyncing = false, 1000);
});

socket.on("play", () => {
    isSyncing = true;
    player.playVideo();
    setTimeout(() => isSyncing = false, 500);
});

socket.on("pause", () => {
    isSyncing = true;
    player.pauseVideo();
    setTimeout(() => isSyncing = false, 500);
});

socket.on("seek", (time) => {
    isSyncing = true;
    player.seekTo(time, true);
    setTimeout(() => isSyncing = false, 500);
});

// 💬 Chat
function sendMsg() {
    let msg = document.getElementById("msg").value;
    socket.emit("chat", msg);

    let div = document.createElement("div");
    div.innerText = "You: " + msg;
    document.getElementById("chatBox").appendChild(div);
}

socket.on("chat", (msg) => {
    let div = document.createElement("div");
    div.innerText = "Partner: " + msg;
    document.getElementById("chatBox").appendChild(div);
});
