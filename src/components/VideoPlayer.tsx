import { Box, Button } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const prevState = useRef<PlayerState>({playing: false, time: 0});
  const desiredState = useRef<PlayerState | null>(null);
  const ended = useRef(false);

  // Update the player state to the given new state.
  const updateState = useCallback((newState: PlayerState) => {
    if (player.current) {
      console.log("change player state ", newState);
      // New state time should not exceed the duration of the video.
      if (newState.time !== undefined) {
        newState.time = Math.min(newState.time, player.current.getDuration());
      }
      desiredState.current = newState;
      // Perform play/pause and possibly seek to achieve the new state.
      setPlaying(newState.playing);
      if (newState.time !== undefined) {
        player.current.seekTo(newState.time, "seconds");
      }
    }
  }, []);

  // Check if the desired state is achieved by the given current state.
  const checkStateAchieved = useCallback((curState: PlayerState) => {
    if (desiredState.current == null) return true;
    return desiredState.current.playing === curState.playing &&
    (desiredState.current.time === undefined || 
    withinThreshold(desiredState.current.time, curState.time!))
  }, []);

  // Send state changed signal to server.
  const sendStateChangedSignal = useCallback((curState: PlayerState) => {
    // If seek detected, send a seek signal.
    if (!withinThreshold(prevState.current.time!, curState.time!)) {
      socket.emit("player_state_changed", curState);
    // Otherwise, check if playing status changed and send a play/pause signal.
    } else if (curState.playing !== prevState.current.playing) {
      socket.emit("player_state_changed", {
        playing: curState.playing
      });
    }
  }, [socket])

  useEffect(() => {
    // Listen to set_player_state signal from server and change 
    // player state accordingly. 
    socket.on("set_player_state", updateState);
  }, [socket, updateState]);

  const handleReady = () => {
    setIsReady(true);
  };

  const handleEnd = () => {
    console.log("Video ended");
    ended.current = true;
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
      setPlaying(true);
      ended.current = false;
      console.log("User played video at time: ", player.current.getCurrentTime());
    }
  };

  const handlePause = () => {
    if (player.current) {
      setPlaying(false);
      ended.current = false;
      console.log("User paused video at time: ", player.current.getCurrentTime());
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
      const curState: PlayerState = {
        playing: player.current.props.playing!,
        // Edge case: after the video ended, onProgress will still be triggered,
        // but the player time (whether obtained from state argument or 
        // getCurrentTime()) will not reach the duration of the video. In such 
        // casem manually set time to duration.
        time: ended.current ? player.current.getDuration() : state.playedSeconds
      }
      if (desiredState.current) {
        // Check whether desired state is achieved. If not, perform another
        // update.
        if (checkStateAchieved(curState)) {
          desiredState.current = null;
        } else {
          updateState(desiredState.current);
        }
      } else {
        console.log("emitting at onProgress", prevState, curState);
        sendStateChangedSignal(curState);
      }
      prevState.current = curState;
    }
  };

  const handleWatchSession = () => {
    setHasJoined(true);
    socket.emit("player_state_init", () => {
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
