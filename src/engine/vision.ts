/**
 * Browser webcam + TensorFlow.js COCO-SSD object detection.
 */

export interface VisionDetection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

let modelPromise: Promise<{
  detect: (img: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<VisionDetection[]>;
}> | null = null;

let stream: MediaStream | null = null;
let videoEl: HTMLVideoElement | null = null;

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      // Dynamic imports keep TensorFlow.js + COCO-SSD out of the main bundle:
      // the chunks are only fetched the first time the webcam ML feature is used.
      await import('@tensorflow/tfjs');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      return model as {
        detect: (img: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<VisionDetection[]>;
      };
    })().catch((err) => {
      // Reset so a later attempt can retry after a transient network failure.
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

/**
 * Kick off the TensorFlow.js + COCO-SSD download/init in the background.
 * Idempotent — every call shares the same in-flight promise, and nothing is
 * loaded until this is called (i.e. when the webcam panel is first used).
 */
export async function preloadModel(): Promise<void> {
  await loadModel();
}

export async function startWebcam(): Promise<HTMLVideoElement> {
  if (videoEl && stream) return videoEl;
  // Download TF.js + COCO-SSD in parallel with the camera permission prompt so
  // the first scan is fast. Failures are silent here; they surface (and retry)
  // from detectFromWebcam() when a scan actually runs.
  void preloadModel().catch(() => {});
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  videoEl = document.createElement('video');
  videoEl.srcObject = stream;
  videoEl.playsInline = true;
  videoEl.muted = true;
  await videoEl.play();
  return videoEl;
}

export function stopWebcam() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  videoEl = null;
}

export function getWebcamVideo(): HTMLVideoElement | null {
  return videoEl;
}

export async function detectFromWebcam(): Promise<VisionDetection[]> {
  const video = await startWebcam();
  // wait for dimensions
  if (video.readyState < 2) {
    await new Promise<void>((r) => {
      video.onloadeddata = () => r();
    });
  }
  const model = await loadModel();
  const preds = await model.detect(video);
  return preds.map((p) => ({
    class: p.class,
    score: p.score,
    bbox: p.bbox as [number, number, number, number],
  }));
}

export async function detectFromElement(
  el: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<VisionDetection[]> {
  const model = await loadModel();
  const preds = await model.detect(el);
  return preds.map((p) => ({
    class: p.class,
    score: p.score,
    bbox: p.bbox as [number, number, number, number],
  }));
}

export function topLabel(dets: VisionDetection[]): string {
  if (!dets.length) return 'none';
  const best = [...dets].sort((a, b) => b.score - a.score)[0];
  return best.class;
}
