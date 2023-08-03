import { useEffect, useState } from "react";
import VideoPlayer from "../components/VideoPlayer";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, TextField, Tooltip } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArrowForward from "@mui/icons-material/ArrowForward";
import { Socket } from "socket.io-client";
import ReactPlayer from "react-player";

const WatchSession: React.FC<{ socket: Socket }> = ({ socket }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);
  const [urlText, setUrlText] = useState<string>("");

  const [linkCopied, setLinkCopied] = useState(false);

  // Listen to update url event and session not found event from server.
  useEffect(() => {
    socket.on("update_url", setUrl);
    socket.on("session_not_found", () => {
      alert("Session not found!");
      navigate("/create");
    });
  }, [socket, navigate]);

  // Join session with session id.
  useEffect(() => {
    socket.emit("join_session", sessionId);
  }, [sessionId, socket]);

  // Update url textfield.
  useEffect(() => {
    if (url !== null) {
      setUrlText(url);
    }
  }, [url])

  const handleUrlSwitch = () => {
    if (!ReactPlayer.canPlay(urlText)) {
      alert("Please enter a valid youtube url!");
      return;
    }
    socket.emit("switch_url", urlText);
  }

  if (!!url) {
    return (
      <>
        <Box
          width="100%"
          maxWidth={1000}
          display="flex"
          gap={1}
          marginTop={1}
          alignItems="center"
        >
          <TextField
            label="Youtube URL"
            value={urlText}
            variant="outlined"
            inputProps={{
              readOnly: false,
              disabled: false,
            }}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setUrlText(event.target.value);
            }}
            fullWidth
          />
          <Tooltip title="Swtich video">
            <Button
              onClick={handleUrlSwitch}
              variant="contained"
              sx={{ whiteSpace: "nowrap", minWidth: "max-content" }}
            >
              <ArrowForward />
            </Button>
          </Tooltip>
          <Tooltip title={linkCopied ? "Link copied" : "Copy link to share"}>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              disabled={linkCopied}
              variant="contained"
              sx={{ whiteSpace: "nowrap", minWidth: "max-content" }}
            >
              <LinkIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Create new watch party">
            <Button
              onClick={() => {
                socket.emit("leave_session", sessionId);
                navigate("/create");
              }}
              variant="contained"
              sx={{ whiteSpace: "nowrap", minWidth: "max-content" }}
            >
              <AddCircleOutlineIcon />
            </Button>
          </Tooltip>
        </Box>
        <VideoPlayer url={url} socket={socket} />;
      </>
    );
  }
  console.log("invalid url");
  return null;
};

export default WatchSession;
