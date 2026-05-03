import * as faceDetection from '@tensorflow-models/face-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';

export class PeekGuardCore {
  private detector: faceDetection.FaceDetector | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    await tf.ready();
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = {
      runtime: 'tfjs',
      maxFaces: 20,
    };
    this.detector = await faceDetection.createDetector(model, detectorConfig);
    this.isInitialized = true;
  }

  async detect(video: HTMLVideoElement) {
    if (!this.detector) return [];
    try {
      const faces = await this.detector.estimateFaces(video, { flipHorizontal: false });
      return faces;
    } catch (e) {
      console.error('Detection error:', e);
      return [];
    }
  }
}

export const peekGuard = new PeekGuardCore();
