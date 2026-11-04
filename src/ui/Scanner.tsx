import { useEffect, useRef, useState } from "react";
import { Icon } from "./components";

// The camera reads a QR code with the browser's own BarcodeDetector (Chrome
// on Android, ChromeOS and macOS). Where it does not exist, the button hides.

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorClass = new (options: { formats: string[] }) => BarcodeDetectorLike;

function detectorClass(): BarcodeDetectorClass | null {
  const found = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  return found && typeof navigator.mediaDevices?.getUserMedia === "function" ? found : null;
}

export const canScan = () => detectorClass() !== null;

export function Scanner({ onText, onClose }: { onText: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let done = false;
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (media) => {
        if (done) return media.getTracks().forEach((t) => t.stop());
        stream = media;
        const track = media.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (track && caps.torch) setTorch(track);
        if (!video.current) return;
        video.current.srcObject = media;
        await video.current.play();
        const look = async () => {
          if (done || !video.current) return;
          try {
            const [code] = await detector.detect(video.current);
            if (code?.rawValue && !done) {
              done = true;
              onText(code.rawValue);
              return;
            }
          } catch {
            // A frame that could not be read: try the next one.
          }
          timer = window.setTimeout(look, 250);
        };
        void look();
      })
      .catch(() => setError("The camera is not available. Allow it for this site, or paste the address."));
    return () => {
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onText]);

  const toggleTorch = () => {
    if (!torch) return;
    const next = !lit;
    torch
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setLit(next), () => setTorch(null));
  };

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scan a QR code">
      <video ref={video} muted playsInline />
      <div className="scanner-frame" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="scanner-bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the camera">
          <Icon name="close" />
        </button>
        {torch && (
          <button type="button" className="icon-btn" onClick={toggleTorch} aria-label={lit ? "Turn the light off" : "Turn the light on"} aria-pressed={lit}>
            <Icon name="light" />
          </button>
        )}
      </div>
      <p className="scanner-hint">{error ?? "Center the QR code in the frame. It is read on its own."}</p>
    </div>
  );
}
