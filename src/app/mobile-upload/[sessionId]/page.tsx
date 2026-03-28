"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import io from "socket.io-client";
import { Button } from "@/components/ui/button";

export default function MobileUploadPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<'environment'|'user'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL as string) || '';
    const s = socketUrl ? io(socketUrl, { transports: ['websocket', 'polling'] }) : io({ transports: ['websocket', 'polling'] });
    setSocket(s);
    s.emit('session:join', sessionId);
    return () => { s.disconnect(); };
  }, [sessionId]);

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot({ width: 1280, height: 720 });
    if (imageSrc) setCaptured(imageSrc);
  };

  const retake = () => setCaptured(null);

  const upload = () => {
    if (!captured || !socket) return;
    socket.emit('invoice:upload', { sessionId, imageData: captured });
    router.push('/mobile-upload/success');
  };

  const videoConstraints = { facingMode } as MediaTrackConstraints;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-center">Upload Invoice</h1>
      {!captured ? (
        <div className="flex flex-col items-center gap-3">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full max-w-md rounded border"
          />
          <div className="flex gap-2">
            <Button onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}>Switch Camera</Button>
            <Button onClick={capture}>Capture</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <img src={captured} alt="preview" className="w-full max-w-md rounded border" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={retake}>Retake</Button>
            <Button onClick={upload}>Upload</Button>
          </div>
        </div>
      )}
    </div>
  );
}


