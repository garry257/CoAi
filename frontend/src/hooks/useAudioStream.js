import { useState, useRef, useCallback, useEffect } from 'react';

const isProd = import.meta.env.PROD;
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const VOICE_WS_URL = isProd 
  ? `${wsProtocol}//${window.location.host}/voice` 
  : `${wsProtocol}//127.0.0.1:5005/voice`;

export const useAudioStream = (interviewId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);

  // Voice gender selection: expose exactly 2 clear options — Woman & Man
  // Each picks the best natural/online voice available for that gender
  const VOICE_OPTIONS = [{ label: '👩 Woman', gender: 'female' }, { label: '👨 Man', gender: 'male' }];

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const pickBestVoice = (voices, gender) => {
      const femaleNames = ['Zira', 'Jenny', 'Aria', 'Susan', 'Samantha', 'Victoria', 'Karen', 'Moira', 'Tessa', 'Female', 'Woman', 'Google UK English Female', 'Google US English'];
      const maleNames   = ['Guy', 'David', 'Mark', 'James', 'Daniel', 'Alex', 'Fred', 'Google UK English Male', 'Male', 'Man'];
      const keywords = gender === 'female' ? femaleNames : maleNames;

      const en = voices.filter(v => v.lang.startsWith('en'));

      // Priority 1: Online Natural + gender keyword
      let match = en.find(v => v.name.includes('Online (Natural)') && keywords.some(k => v.name.includes(k)));
      // Priority 2: Any Natural + gender keyword
      if (!match) match = en.find(v => (v.name.includes('Natural') || v.name.includes('Google')) && keywords.some(k => v.name.includes(k)));
      // Priority 3: any voice with gender keyword
      if (!match) match = en.find(v => keywords.some(k => v.name.toLowerCase().includes(k.toLowerCase())));
      // Priority 4: first en-US voice for female, second for male
      if (!match) {
        const us = en.filter(v => v.lang === 'en-US');
        match = gender === 'female' ? us[0] : us[1] || us[0];
      }
      return match || (gender === 'female' ? en[0] : en[1] || en[0]);
    };

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      const female = pickBestVoice(voices, 'female');
      const male   = pickBestVoice(voices, 'male');
      setAvailableVoices([female, male].filter(Boolean));
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null; };
  }, []);


  // Speech Synthesis (AI Speaking out loud - Natural & Clear)
  const speakText = useCallback((text) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    // Cancel any current speaking
    window.speechSynthesis.cancel();

    if (!text) return;

    // Clean text for clear articulation
    let cleanText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_#`~>|-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;  // Slightly slower pace for maximum clarity and articulation
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Select voice
    const voices = window.speechSynthesis.getVoices();
    let chosenVoice = availableVoices[selectedVoiceIndex];

    if (!chosenVoice && voices.length > 0) {
      chosenVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Online (Natural)') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
      ) || voices.find((v) => v.lang.startsWith('en'));
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [availableVoices, selectedVoiceIndex]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

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
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        setIsConnected(true);
      }
      return;
    }

    try {
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
              if (msg.text) {
                speakText(msg.text);
              }
            } else if (msg.type === 'ready' || msg.type === 'session_initialized') {
              setIsConnected(true);
            } else if (msg.type === 'error') {
              console.warn('[Voice WS] Message info:', msg.message);
            } else if (msg.type === 'terminated') {
              stopRecording();
              stopSpeaking();
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
          }, 3000);
        }
      };

      ws.onerror = (event) => {
        console.error('[Voice WS] Error:', event);
      };
    } catch (err) {
      console.error('[Voice WS] Connection exception:', err);
    }
  }, [playAudioChunk, stopRecording, stopSpeaking, speakText]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    stopRecording();
    stopSpeaking();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [stopRecording, stopSpeaking]);

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
    setError(null);
    stopSpeaking();
    setTranscript('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let accumulatedTranscript = '';

        recognition.onresult = (event) => {
          let currentSessionText = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedTranscript += `${transcriptChunk} `;
            } else {
              currentSessionText += transcriptChunk;
            }
          }
          const fullText = `${accumulatedTranscript}${currentSessionText}`.trim();
          setTranscript(fullText);
        };

        recognition.onerror = (event) => {
          console.warn('[SpeechRecognition] Error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone permission denied. Please allow mic access in your browser settings.');
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // ignore
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
        return;
      } catch (err) {
        console.warn('[SpeechRecognition] Initialization failed, falling back to WebAudio stream:', err);
      }
    }

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
  }, [stopSpeaking]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isRecording,
    isSpeaking,
    transcript,
    error,
    availableVoices,
    selectedVoiceIndex,
    setSelectedVoiceIndex,
    connect,
    disconnect,
    initSession,
    updateContext,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    clearTranscript,
  };
};
