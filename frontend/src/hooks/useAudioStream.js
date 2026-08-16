import { useState, useRef, useCallback, useEffect } from 'react';

const isProd = import.meta.env.PROD;
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const VOICE_WS_URL = isProd 
  ? `${wsProtocol}//${window.location.host}/voice` 
  : `${wsProtocol}//127.0.0.1:5005/voice`;

export const useAudioStream = (interviewId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const playAudioChunk = useCallback(async (pcmArrayBuffer) => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
    }

    const audioContext = audioContextRef.current;
    const int16 = new Int16Array(pcmArrayBuffer);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i += 1) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = audioContext.createBuffer(1, float32.length, 16000);
    audioBuffer.getChannelData(0).set(float32);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const now = audioContext.currentTime;
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now;
    }

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  }, []);

  const clearTranscript = useCallback(() => setTranscript(''), []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(VOICE_WS_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'transcript') {
            setTranscript((prev) => `${prev}${prev ? ' ' : ''}${msg.text || ''}`.trim());
          } else if (msg.type === 'ready') {
            setIsConnected(true);
          } else if (msg.type === 'error') {
            setError(msg.message || 'Voice connection error');
          } else if (msg.type === 'connection_closed') {
            setIsConnected(false);
          } else if (msg.type === 'terminated') {
            stopRecording();
            setIsConnected(false);
          }
        } catch (parseError) {
          console.error('[Voice WS] Failed to parse message:', parseError);
        }
      } else if (event.data instanceof ArrayBuffer) {
        await playAudioChunk(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      stopRecording();
      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = (event) => {
      console.error('[Voice WS] Error:', event);
      setError('WebSocket connection error. Retrying...');
    };
  }, [playAudioChunk, stopRecording]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    stopRecording();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [stopRecording]);

  const initSession = useCallback((role, question) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'init',
      interviewId,
      role,
      interviewType: question?.interviewType || 'technical',
      company: question?.company || '',
      difficulty: question?.difficulty || 'medium',
      question,
    }));
  }, [interviewId]);

  const updateContext = useCallback((question) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'update_context',
      question,
      interviewId,
    }));
  }, [interviewId]);

  const floatTo16BitPCM = (input) => {
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm.buffer;
  };

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }

      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const streamSource = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = streamSource;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(input);
        wsRef.current.send(pcmData);
      };

      streamSource.connect(processor);
      processor.connect(audioContext.destination);
      streamRef.current = stream;

      setIsRecording(true);
      setError(null);
    } catch (error) {
      console.error('[Voice WS] Microphone permission error:', error);
      setError('Mic permission was denied or the device is unavailable.');
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
