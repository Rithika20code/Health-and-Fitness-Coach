import { createContext, useContext, ReactNode } from 'react'
import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  VideoCapture,
  AudioCapture,
  AudioPlayback,
} from '@runanywhere/web'
import { LlamaCPP, TextGeneration, VLMWorkerBridge, startVLMWorkerRuntime } from '@runanywhere/web-llamacpp'
import { ONNX, STT, TTS, VAD } from '@runanywhere/web-onnx'

let isInitialized = false
let isLLMLoaded = false
let isVLMLoaded = false

export async function initializeSDK(): Promise<void> {
  if (isInitialized) return

  await RunAnywhere.initialize({
    environment: SDKEnvironment.Development,
    debug: true,
  })

  await LlamaCPP.register()
  await ONNX.register()

  RunAnywhere.registerModels([
    {
      id: 'lfm2-vl-450m-q4_0',
      name: 'LFM2-VL 450M Q4_0',
      repo: 'runanywhere/LFM2-VL-450M-GGUF',
      files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
      framework: 'LlamaCpp' as any,
      modality: 'vision' as any,
      memoryRequirement: 500_000_000,
    },
    {
      id: 'qwen2-0.5b-instruct-q4_0',
      name: 'Qwen2 0.5B Q4_0',
      repo: 'Qwen/Qwen2-0.5B-Instruct-GGUF',
      files: ['qwen2-0.5b-instruct-q4_0.gguf'],
      framework: 'LlamaCpp' as any,
      modality: 'language' as any,
      memoryRequirement: 500_000_000,
    },
  ])

  await initializeLLM()
  await initializeVLM()

  isInitialized = true
}

export async function initializeVLM(): Promise<void> {
  if (isVLMLoaded) return

  try {

    // ⭐ IMPORTANT LINE (DOWNLOAD MODEL FIRST)
    await ModelManager.downloadModel('lfm2-vl-450m-q4_0')

    await startVLMWorkerRuntime()
    await VLMWorkerBridge.shared.init()

    await VLMWorkerBridge.shared.loadModel({
      modelId: 'lfm2-vl-450m-q4_0',
      modelOpfsKey: 'lfm2-vl-450m-q4_0',
      modelFilename: 'LFM2-VL-450M-Q4_0.gguf',
      mmprojOpfsKey: 'lfm2-vl-450m-q4_0',
      mmprojFilename: 'mmproj-LFM2-VL-450M-Q8_0.gguf',
      modelName: 'LFM2-VL-450M-Q4_0',
    })

    isVLMLoaded = true

  } catch (err) {
    console.error('Failed to initialize VLM:', err)
    throw err
  }
}

export async function initializeLLM(): Promise<void> {
  if (isLLMLoaded) return

  try {

    await ModelManager.downloadModel('qwen2-0.5b-instruct-q4_0')
    await ModelManager.loadModel('qwen2-0.5b-instruct-q4_0')

    isLLMLoaded = true

  } catch (err) {
    console.error('Failed to initialize LLM:', err)
    throw err
  }
}

export async function ensureLLM(): Promise<void> {
  if (!isLLMLoaded) {
    await initializeLLM()
  }
}

export async function ensureVLM(): Promise<void> {
  if (!isVLMLoaded) {
    await initializeVLM()
  }
}

export function getVLMWorkerBridge() {
  return VLMWorkerBridge.shared
}

export { ModelManager, VideoCapture, AudioCapture, AudioPlayback, STT, TTS, VAD, TextGeneration, VLMWorkerBridge }

export async function speakText(text: string): Promise<void> {
  try {
    const result = await TTS.synthesize(text, { speed: 1.0 })
    const player = new AudioPlayback()
    await player.play(result.audioData, result.sampleRate)
  } catch (err) {
    console.warn('RunAnywhere TTS failed, using browser fallback:', err)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }
}

interface RunAnywhereContextType {
  isReady: boolean
}

const RunAnywhereContext = createContext<RunAnywhereContextType>({ isReady: false })

export function RunAnywhereProvider({ children }: { children: ReactNode }) {
  return (
    <RunAnywhereContext.Provider value={{ isReady: isInitialized }}>
      {children}
    </RunAnywhereContext.Provider>
  )
}

export function useRunAnywhere() {
  return useContext(RunAnywhereContext)
}
