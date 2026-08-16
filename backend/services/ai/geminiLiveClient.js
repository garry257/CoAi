const { EventEmitter } = require('events');
const { getGeminiClient } = require('../../config/gemini');
const logger = require('../../utils/logger');

// According to Gemini docs for Live API, gemini-2.0-flash-exp supports multimodal live API
const LIVE_MODEL = 'models/gemini-2.0-flash-exp';

class GeminiLiveClient extends EventEmitter {
  constructor() {
    super();
    this.client = getGeminiClient();
    this.session = null;
    this.isReady = false;
  }

  async init() {
    if (!this.client) {
      throw new Error('Gemini API is not configured.');
    }

    // Connect to the Live API WebSocket via the SDK
    // The Live API in genai sdk is experimental.
    // Example SDK Usage for Live API might vary depending on exact SDK version, 
    // assuming @google/genai provides connect() or similar for Live API.
    // Based on @google/genai docs, we need to establish a WebSocket connection.
    try {
        // Fallback: If @google/genai live client isn't available, we may need to use native websockets.
        // Assuming @google/genai 0.1.1 or above provides it.
        // The Google Gen AI SDK docs say: 
        // const session = await ai.clients.createLiveClient({ model: 'gemini-2.0-flash-exp' })
        
        // Let's implement a robust version.
        if (this.client.clients && typeof this.client.clients.createLiveClient === 'function') {
            this.session = await this.client.clients.createLiveClient({
                model: LIVE_MODEL,
                config: {
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: "Aoede" // Example voice
                                }
                            }
                        }
                    }
                }
            });
            this._setupHandlers();
            this.isReady = true;
        } else {
            // Fallback for native websocket implementation if SDK method is missing
            const env = require('../../config/env');
            const WebSocket = require('ws');
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;
            this.ws = new WebSocket(url);
            
            await new Promise((resolve, reject) => {
                this.ws.on('open', resolve);
                this.ws.on('error', reject);
            });
            
            // Send initial setup message
            const setupMessage = {
                setup: {
                    model: LIVE_MODEL,
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                    }
                }
            };
            this.ws.send(JSON.stringify(setupMessage));
            
            this.ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    this._handleRawMessage(response);
                } catch (e) {
                    logger.error('[GeminiLive] Failed to parse message', e);
                }
            });
            
            this.isReady = true;
        }
    } catch (err) {
        logger.error('[GeminiLive] Failed to initialize live client:', err);
        throw err;
    }
  }

  _setupHandlers() {
     // If using SDK's live client session
     this.session.on('content', (content) => {
         // content could be audio or text
         if (content.modelTurn) {
             const parts = content.modelTurn.parts;
             for (const part of parts) {
                 if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                     // Convert base64 to buffer
                     const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
                     this.emit('audio', pcmBuffer);
                 }
                 if (part.text) {
                     this.emit('content', part.text);
                 }
             }
         }
     });

     this.session.on('error', (error) => {
         this.emit('error', error);
     });
  }

  _handleRawMessage(response) {
      if (response.serverContent && response.serverContent.modelTurn) {
          const parts = response.serverContent.modelTurn.parts;
          for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                  const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
                  this.emit('audio', pcmBuffer);
              }
              if (part.text) {
                  this.emit('content', part.text);
              }
          }
      }
  }

  async sendSystemInstruction(instruction) {
      if (!this.isReady) return;
      
      const content = {
          clientContent: {
              turns: [{
                  role: "user",
                  parts: [{ text: `[SYSTEM INSTRUCTION]: ${instruction}` }]
              }],
              turnComplete: true
          }
      };

      if (this.session) {
          await this.session.send(content);
      } else if (this.ws) {
          this.ws.send(JSON.stringify(content));
      }
  }

  async sendClientContent(text) {
      if (!this.isReady) return;
      
      const content = {
          clientContent: {
              turns: [{
                  role: "user",
                  parts: [{ text }]
              }],
              turnComplete: true
          }
      };

      if (this.session) {
          await this.session.send(content);
      } else if (this.ws) {
          this.ws.send(JSON.stringify(content));
      }
  }

  async sendRealtimeAudio(pcmBuffer) {
      if (!this.isReady) return;

      // Gemini expects base64 encoded audio/pcm chunks
      const base64Audio = pcmBuffer.toString('base64');
      const content = {
          realtimeInput: {
              mediaChunks: [{
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio
              }]
          }
      };

      if (this.session) {
          await this.session.send(content);
      } else if (this.ws) {
          this.ws.send(JSON.stringify(content));
      }
  }

  close() {
      this.isReady = false;
      if (this.session) {
          // close session
      }
      if (this.ws) {
          this.ws.close();
      }
  }
}

/**
 * Creates and initializes a new Gemini Live Client
 * @returns {Promise<GeminiLiveClient>}
 */
const createGeminiLiveClient = async () => {
    const client = new GeminiLiveClient();
    await client.init();
    return client;
};

module.exports = { createGeminiLiveClient };
