import { Box, Button } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Socket } from "socket.io-client";
import { PlayerState } from "../../utils/types"

interface VideoPlayerProps {
  url: string;
  socket: Socket;
  hideControls?: boolean;
}

const DELTA_T: number = 1.3; // Threshold for checking seek action.
const withinThreshold = (prevTime: number, curTime: number) => 
                        curTime - prevTime <= DELTA_T && prevTime <= curTime


const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, socket, hideControls }) => {
  const [hasJoined, setHasJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<ReactPlayer>(null);
  const prevTime = useRef(0.0);
  const desiredState = useRef<PlayerState | null>({playing: true});

  useEffect(() => {
    // Listen to set_player_state signal from server and change 
    // player state accordingly. 
    socket.on("set_player_state", (newState: PlayerState) => {
      if (player.current) {
        console.log("change player state ", newState);
        // set the new state as the desired state.
        desiredState.current = newState;
        if (player.current.props.playing !== newState.playing) {
          setPlaying(newState.playing);
        }
        if (newState.currentTime !== undefined) {
          prevTime.current = newState.currentTime;
          player.current.seekTo(newState.currentTime, "seconds");
        }
      }
    });
  }, [socket]);

  const handleReady = () => {
    setIsReady(true);
  };

  const handleEnd = () => {
    console.log("Video ended");
  };

  const handleSeek = (seconds: number) => {
    // Ideally, the seek event would be fired whenever the user moves the built in Youtube video slider to a new timestamp.
    // However, the youtube API no longer supports seek events (https://github.com/cookpete/react-player/issues/356), so this no longer works

    // You'll need to find a different way to detect seeks (or just write your own seek slider and replace the built in Youtube one.)
    // Note that when you move the slider, you still get play, pause, buffer, and progress events, can you use those?

    console.log(
      "This never prints because seek decetion doesn't work: ",
      seconds
    );
  };

  const handlePlay = () => {
    if (player.current) {
      const curTime = player.current.getCurrentTime()
      console.log("User played video at time: ", curTime, desiredState.current);
      // the client should not send player state update signal to server
      // before the desired state is achieved.
      if (desiredState.current === null) {
        const player_state: PlayerState = {playing: true}
        socket.emit("player_state_changed", player_state);
      }
      // syncing.current = false;
      setPlaying(true);
    }
  };

  const handlePause = () => {
    if (player.current) {
      const curTime = player.current.getCurrentTime()
      console.log("User paused video at time: ", curTime);
  
      if (desiredState.current === null) {
        const player_state: PlayerState = {playing: false}
        socket.emit("player_state_changed", player_state);
      }
      // syncing.current = false;
      setPlaying(false);
    }
  };

  const handleBuffer = () => {
    console.log("Video buffered");
  };

  const handleProgress = (state: {
    played: number;
    playedSeconds: number;
    loaded: number;
    loadedSeconds: number;
  }) => {
    console.log("Video progress: ", state);
    if (player.current) {
      // Check if desired state is achieved.
      if (desiredState.current && 
        desiredState.current.playing === player.current.props.playing) {
        if (desiredState.current.currentTime === undefined || 
          withinThreshold(desiredState.current.currentTime, state.playedSeconds)) {
            desiredState.current = null;
          }
      }
      if (desiredState.current === null) {
        // Check if a seek took place.
        if (!withinThreshold(prevTime.current, state.playedSeconds)) {
          socket.emit("player_state_changed", { 
            playing: playing, currentTime: state.playedSeconds 
          });
        }
      }
    }
    prevTime.current = state.playedSeconds;
  };

  const handleWatchSession = () => {
    setHasJoined(true);
    socket.emit("player_state_init", () => {
      desiredState.current = null;
      setPlaying(true);
    });
  };

  return (
    <Box
      width="100%"
      height="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
    >
      <Box
        width="100%"
        height="100%"
        display={hasJoined ? "flex" : "none"}
        flexDirection="column"
      >
        <ReactPlayer
          ref={player}
          url={url}
          playing={hasJoined && playing}
          controls={!hideControls}
          onReady={handleReady}
          onEnded={handleEnd}
          onSeek={handleSeek}
          onPlay={handlePlay}
          onPause={handlePause}
          onBuffer={handleBuffer}
          onProgress={handleProgress}
          width="100%"
          height="100%"
          style={{ pointerEvents: hideControls ? "none" : "auto" }}
        />
      </Box>
      {!hasJoined && isReady && (
        // Youtube doesn't allow autoplay unless you've interacted with the page already
        // So we make the user click "Join Session" button and then start playing the video immediately after
        // This is necessary so that when people join a session, they can seek to the same timestamp and start watching the video with everyone else
        <Button
          variant="contained"
          size="large"
          onClick={handleWatchSession}
        >
          Watch Session
        </Button>
      )}
    </Box>
  );
};

export default VideoPlayer;
