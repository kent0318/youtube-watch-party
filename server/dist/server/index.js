"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
;
const sessions = new Map();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: "http://localhost:3000" } });
io.on("connection", (socket) => {
    console.log("client connected");
    socket.on("create_session", (sessionId, url, acknowledge) => {
        sessions.set(sessionId, {
            id: sessionId,
            url: url,
            playing: true,
            prevTime: 0,
            prevVideoTime: 0,
            started: false
        });
        acknowledge();
        console.log(`created session ${sessionId} with url ${url}`);
    });
    // Fetch youtube url given session id.
    socket.on("join_session", (sessionId, callback) => {
        if (sessions.has(sessionId)) {
            socket.join(sessionId);
            console.log("joined session", sessionId);
            callback(sessions.get(sessionId).url);
        }
        else {
            callback();
            console.log("session not found");
        }
    });
    // Intiialize and sync player state once client joined session and started
    // watching. 
    socket.on("player_state_init", (onSessionStartCallback) => {
        for (const room of socket.rooms) {
            if (sessions.has(room)) {
                const session = sessions.get(room);
                if (session.started) {
                    const playerState = {
                        playing: session.playing,
                        currentTime: session.prevVideoTime
                    };
                    if (session.playing) {
                        playerState.currentTime += (Date.now() - session.prevTime) / 1000;
                    }
                    socket.emit("set_player_state", playerState);
                    console.log("client syncing with state", playerState);
                    // Let the client start playing the video instead of syncing if
                    // the session has not actually started (the client is the first to join).
                }
                else {
                    session.prevTime = Date.now();
                    onSessionStartCallback();
                    console.log("first client joined session");
                }
            }
        }
    });
    socket.on("leave_session", (sessionId) => {
        socket.leave(sessionId);
        console.log("user left session");
    });
    socket.on("disconnect", () => {
        console.log("client disconnected");
    });
    // Upon player state change, broadcast the change to all the other
    // clients in the session.
    socket.on("player_state_changed", (playerState) => {
        for (const room of socket.rooms) {
            if (sessions.has(room)) {
                const session = sessions.get(room);
                const curTime = Date.now();
                if (playerState.currentTime === undefined) {
                    if (session.playing) {
                        session.prevVideoTime += (curTime - session.prevTime) / 1000;
                    }
                }
                else {
                    session.prevVideoTime = playerState.currentTime;
                }
                session.playing = playerState.playing;
                session.prevTime = curTime;
                session.started = true;
                socket.to(room).emit("set_player_state", playerState);
            }
        }
        console.log("player state changed to", playerState, socket.id);
    });
});
io.sockets.adapter.on("delete-room", (room) => {
    if (sessions.has(room)) {
        sessions.delete(room);
        console.log(`session ${room} deleted`);
    }
});
// Server runs on port 3001.
server.listen(3001, () => {
    console.log("Server start");
});
// https://www.youtube.com/watch?v=pdvtJmMSQmQ&ab_channel=Vtuber%E5%82%B3%E6%95%99%E5%B8%AB%28Vspo%21%29
