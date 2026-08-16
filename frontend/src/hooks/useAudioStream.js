import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage real-time audio streaming for the Voice Interview.
 * Connects to the backend WebSocket and handles AudioContext for capturing/playing PCM 16kHz audio.
 * @param {string} interviewId - The ID of the current interview
 */
export const useAudioStream = (interviewId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  
  // Connect to the backend WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    // In dev, assuming the backend runs on port 5005
    const wsUrl = `ws://localhost:5005/voice`;
    const ws = new WebSocket(wsUrl);
    
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      console.log('[Voice WS] Connected');
      setIsConnected(true);
      setError(null);
    };
    
    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transcript') {
          setTranscript((prev) => prev + ' ' + msg.text);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Handle incoming audio chunk from Gemini for playback
        playAudioChunk(event.data);
      }
    };
    
    ws.onclose = () => {
      console.log('[Voice WS] Disconnected');
      setIsConnected(false);
      stopRecording();
    };
    
    ws.onerror = (err) => {
      console.error('[Voice WS] Error:', err);
      setError('WebSocket connection error');
    };
    
    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopRecording();
  }, []);

  const initSession = useCallback((role, question) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'init', interviewId, role, question }));
    }
  }, [interviewId]);

  const updateContext = useCallback((question) => {
     if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'update_context', question }));
     }
  }, []);

  // Utility to convert Float32 (Web Audio API) to Int16 (Gemini expects 16-bit PCM)
  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Gemini Live expects 16kHz audio rate usually, let's use 16000
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      // Deprecated but still widely used for simple PCM extraction without Worklet boilerplate
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = floatTo16BitPCM(inputData);
          wsRef.current.send(pcmData);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current && audioContextRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  // Playback function for incoming PCM data
  const playAudioChunk = async (pcmArrayBuffer) => {
     if (!audioContextRef.current) return;
     
     const audioContext = audioContextRef.current;
     
     // Convert 16-bit PCM (Int16Array) back to Float32Array
     const int16 = new Int16Array(pcmArrayBuffer);
     const float32 = new Float32Array(int16.length);
     for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
     }

     const audioBuffer = audioContext.createBuffer(1, float32.length, 16000);
     audioBuffer.getChannelData(0).set(float32);

     const source = audioContext.createBufferSource();
     source.buffer = audioBuffer;
     source.connect(audioContext.destination);

     const currentTime = audioContext.currentTime;
     if (nextPlayTimeRef.current < currentTime) {
         nextPlayTimeRef.current = currentTime;
     }
     
     source.start(nextPlayTimeRef.current);
     nextPlayTimeRef.current += audioBuffer.duration;
  };

  const clearTranscript = () => setTranscript('');

  return {
    isConnected,
    isRecording,
    transcript,
    error,
    connect,
    disconnect,
    initSession,
    updateContext,
    startRecording,
    stopRecording,
    clearTranscript,
  };
};
