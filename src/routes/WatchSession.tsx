import { useEffect, useState, useRef } from "react";
import VideoPlayer from "../components/VideoPlayer";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, TextField, Tooltip } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { Socket } from "socket.io-client";

const WatchSession: React.FC<{ socket: Socket }> = ({ socket }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    socket.emit("join_session", sessionId, (urlReceived?: string) => { 
      if (urlReceived !== undefined) {
        setUrl(urlReceived); 
      } else {
        alert("Session not found!");
        navigate("/create");
      } 
    });
  }, [sessionId]);

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
            variant="outlined"
            value={url}
            inputProps={{
              readOnly: true,
              disabled: true,
            }}
            fullWidth
          />
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
