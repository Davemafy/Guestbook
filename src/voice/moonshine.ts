export type VoiceProgress = {
  fraction: number;
  file: string;
  loaded?: number;
  total?: number;
};

export type VoiceCallbacks = {
  onText: (text: string) => void;
  onLine: (text: string) => void;
  onProgress: (progress: VoiceProgress) => void;
  onError: (error: Error) => void;
};

export type OfflineVoiceController = {
  load: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  close: () => void;
};

const MOONSHINE_MIRROR =
  "https://huggingface.co/moonshine-ai/moonshine-voice-assets/resolve/v0.1.5/model/tiny-streaming-en/quantized_26_08_21";

const KEYTERMS = [
  "coffee",
  "coffee beans",
  "roasting",
  "take home",
  "wheelchair",
  "accessible",
  "walking",
  "road",
  "taxi",
  "price",
  "card",
  "cash",
  "booking",
  "allergy",
];

export async function createOfflineVoice(callbacks: VoiceCallbacks): Promise<OfflineVoiceController> {
  const { MicTranscriber, ModelArch } = await import("@moonshine-ai/moonshine-wasm");

  const mic = new MicTranscriber()
    .language("en")
    .modelArch(ModelArch.TinyStreaming)
    .modelsFrom(MOONSHINE_MIRROR)
    .onText((text) => callbacks.onText(text))
    .onLine((line) => callbacks.onLine(line.text))
    .onProgress((fraction, file, progress) => {
      callbacks.onProgress({
        fraction,
        file,
        loaded: progress?.loaded,
        total: progress?.total,
      });
    })
    .onError((error) => callbacks.onError(error));

  return {
    async load() {
      await mic.load();
      mic.setKeyterms(KEYTERMS);
    },
    async start() {
      await mic.start();
    },
    async stop() {
      await mic.stop();
    },
    close() {
      mic.close();
    },
  };
}
