import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, TextField } from "@mui/material";
import { v4 as uuidv4 } from "uuid";
import { Socket } from "socket.io-client";
import ReactPlayer from "react-player";

const CreateSession: React.FC<{socket: Socket}> = ({socket}) => {
  const navigate = useNavigate();
  const [newUrl, setNewUrl] = useState("");

  const createSession = async () => {
    // Check if the url is a playable url.
    if (!ReactPlayer.canPlay(newUrl)) {
      alert("Please enter a valid youtube url!");
      return;
    }
    const sessionId = uuidv4();
    await socket.emitWithAck("create_session", sessionId, newUrl);
    navigate(`/watch/${sessionId}`);
  };

  return (
    <Box width="100%" maxWidth={600} display="flex" gap={1} marginTop={1}>
      <TextField
        label="Youtube URL"
        variant="outlined"
        value={newUrl}
        onChange={(e) => setNewUrl(e.target.value)}
        fullWidth
      />
      <Button
        disabled={!newUrl}
        onClick={createSession}
        size="small"
        variant="contained"
      >
        Create a session
      </Button>
    </Box>
  );
};

export default CreateSession;
