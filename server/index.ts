import express from "express"
import http from "http"
import { Server } from "socket.io";
import { PlayerState } from "../utils/types"
import { url } from "inspector";

interface Session {
    id: string,
    url: string,
    playing: boolean,
    prevTime: number,
    prevVideoTime: number,
    started: boolean
};

// Map from session id to session object.
const sessions: Map<string, Session> = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {cors: {origin: "http://localhost:3000"}});

io.on("connection", (socket) => {
    console.log("client connected");
    // Create session based on the given session id and youtube url, 
    // then acknowledge so that client can proceed to watch session page.
    socket.on("create_session", (sessionId: string, url: string, acknowledge) => {
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

    // Join session and fetch url.
    socket.on("join_session", (sessionId: string) => {
        if (sessions.has(sessionId)) {
            socket.join(sessionId); 
            socket.emit("update_url", sessions.get(sessionId)!.url);
            console.log("joined session", sessionId);       
        } 
        // If no session id found, call back with no argument to indicate a failure.
        else {
            socket.emit("session_not_found");
            console.log("session not found");
        }
    });

    // Switch url and broadcast to every clients in the session.
    socket.on("switch_url", (url: string) => {
        for (const room of socket.rooms) {
            if (sessions.has(room)) {
                sessions.set(room, {
                    id: room, 
                    url: url, 
                    playing: true,
                    prevTime: 0,
                    prevVideoTime: 0,
                    started: false
                });
            }
            io.to(room).emit("update_url", url);
        }
        console.log("switch url to ", url);
    });

    // Intiialize and sync player state once client joined session and started
    // watching. 
    socket.on("player_state_init", (onSessionStartCallback) => {
        for (const room of socket.rooms) {
            if (sessions.has(room)) {
                const session = sessions.get(room)!;
                if (session.started) {
                    const playerState: PlayerState = { 
                        playing: session.playing,
                        time: session.prevVideoTime
                    };
                    // If the session has been playing, calculate the expected 
                    // video time.
                    if (session.playing) {
                        playerState.time! += (Date.now() - session.prevTime)/1000;
                    }
                    socket.emit("set_player_state", playerState);
                    console.log("client syncing with state", playerState);
                // Let the client start playing the video instead of syncing if
                // the session has not actually started (in other words, the 
                // client is the first to join).
                } else {
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
    socket.on("player_state_changed", (playerState: PlayerState) => {
        for (const room of socket.rooms) {
            if (sessions.has(room)) {
                const session = sessions.get(room)!
                const curTime = Date.now();
                if (playerState.time === undefined) {
                    if (session.playing) {
                        session.prevVideoTime += (curTime - session.prevTime)/1000;
                    }
                } else {
                    session.prevVideoTime = playerState.time;
                }
                // Update session status.
                session.playing = playerState.playing;
                session.prevTime = curTime;
                session.started = true;
                socket.to(room).emit("set_player_state", playerState);
            }
        }
        console.log("player state changed to", playerState, socket.id);
    });
});

// On room delete, delete the corresponding session.
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