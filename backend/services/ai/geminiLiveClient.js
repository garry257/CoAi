const { EventEmitter } = require('events');
const WebSocket = require('ws');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const LIVE_MODEL = 'models/gemini-2.0-flash-exp';
const LIVE_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;

class GeminiLiveClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isReady = false;
    this.connectionReady = null;
    this.connectionError = null;
  }

  async init() {
    if (!env.GEMINI_API_KEY) {
      throw new Error('Gemini API is not configured. Set GEMINI_API_KEY in backend/.env');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(LIVE_WS_URL);

        const cleanup = () => {
          this.ws.removeAllListeners('open');
          this.ws.removeAllListeners('error');
          this.ws.removeAllListeners('message');
          this.ws.removeAllListeners('close');
        };

        this.ws.on('open', () => {
          logger.info('[GeminiLive] WebSocket connected to Gemini Live');

          const setupMessage = {
            setup: {
              model: LIVE_MODEL,
              generationConfig: {
                responseModalities: ['AUDIO', 'TEXT'],
                temperature: 0.2,
                topP: 0.9,
              },
              systemInstruction: {
                parts: [{ text: 'You are a professional interview assistant. Ask one question at a time, and keep responses concise but useful.' }],
              },
            },
          };

          this.ws.send(JSON.stringify(setupMessage));
        });

        this.ws.on('message', (data) => {
          try {
            const payload = JSON.parse(data.toString());
            this._handleIncomingMessage(payload);
          } catch (error) {
            logger.error('[GeminiLive] Failed to parse Gemini message:', error.message);
          }
        });

        this.ws.on('error', (error) => {
          this.connectionError = error;
          logger.error('[GeminiLive] WebSocket error:', error.message || error);
          this.emit('error', error);
          cleanup();
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          logger.warn(`[GeminiLive] WebSocket closed: ${code} ${reason ? reason.toString() : ''}`);
          this.isReady = false;
          this.emit('closed', { code, reason: reason ? reason.toString() : '' });
        });

        this.ws.on('open', () => {
          this.isReady = true;
          this.emit('ready');
          resolve(this);
        });
      } catch (error) {
        logger.error('[GeminiLive] Failed to initialize Gemini Live client:', error.message);
        reject(error);
      }
    });
  }

  _handleIncomingMessage(payload) {
    if (payload.setupComplete) {
      this.isReady = true;
      this.emit('ready');
      return;
    }

    if (payload.serverContent) {
      const modelTurn = payload.serverContent.modelTurn;
      const parts = modelTurn?.parts || [];

      for (const part of parts) {
        if (part.text) {
          this.emit('content', part.text);
        }

        if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          this.emit('audio', audioBuffer);
        }
      }
    }

    if (payload.error) {
      const message = payload.error.message || 'Gemini Live API error';
      logger.error('[GeminiLive] Live API error:', message);
      this.emit('error', new Error(message));
    }
  }

  async sendSystemInstruction(instruction) {
    if (!this.isReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: instruction }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  async sendClientContent(text) {
    if (!this.isReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  async sendRealtimeAudio(pcmBuffer) {
    if (!this.isReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const base64Audio = Buffer.from(pcmBuffer).toString('base64');
    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  close() {
    this.isReady = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

const createGeminiLiveClient = async () => {
  const liveClient = new GeminiLiveClient();
  await liveClient.init();
  return liveClient;
};

module.exports = { createGeminiLiveClient, GeminiLiveClient };
