const WebSocket = require('ws');
const { createGeminiLiveClient } = require('../services/ai/geminiLiveClient');
const logger = require('../utils/logger');
const Interview = require('../models/Interview');
const Question = require('../models/Question');

/**
 * Setup WebSocket server for voice interviews
 * @param {http.Server} server - Node.js HTTP Server
 */
const setupVoiceSockets = (server) => {
  // Create a WebSocket Server mounted on /voice
  const wss = new WebSocket.Server({ server, path: '/voice' });

  wss.on('connection', (ws, req) => {
    logger.info('[VoiceController] Client connected to Voice WS');

    let geminiClient = null;
    let currentInterviewId = null;

    ws.on('message', async (data, isBinary) => {
      try {
        if (!isBinary) {
          // Handle JSON commands (init, end, update_context)
          const message = JSON.parse(data.toString());
          
          if (message.type === 'init') {
            currentInterviewId = message.interviewId;
            const questionData = message.question;
            
            // Initialize Gemini Live API for this session
            geminiClient = await createGeminiLiveClient();
            
            // Route events from Gemini back to the frontend Client
            geminiClient.on('audio', (pcmData) => {
              // Send binary PCM chunk to frontend
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(pcmData, { binary: true });
              }
            });

            geminiClient.on('content', (text) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'transcript', text }));
              }
            });

            geminiClient.on('error', (err) => {
              logger.error('[VoiceController] Gemini Live Error:', err);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Gemini Live error' }));
              }
            });

            // Send system instructions to Gemini
            const systemInstruction = `You are an AI interviewer conducting an interview. The candidate's role is ${message.role}.
Current question to ask: "${questionData.question}".
Keep your answers brief and conversational. Speak clearly and wait for the candidate's response.`;
            
            await geminiClient.sendSystemInstruction(systemInstruction);
            
            ws.send(JSON.stringify({ type: 'ready' }));
            logger.info('[VoiceController] Gemini Live API ready for session');

          } else if (message.type === 'update_context') {
             // E.g. when moving to the next question
             if (geminiClient) {
               const sysInstruction = `You are moving to the next question. Next question is: "${message.question.question}". Ask the candidate this question and evaluate their response.`;
               await geminiClient.sendSystemInstruction(sysInstruction);
             }
          } else if (message.type === 'client_content') {
             if (geminiClient && geminiClient.isReady) {
               await geminiClient.sendClientContent(message.text);
             }
          }

        } else {
          // Handle binary PCM audio stream from frontend
          if (geminiClient && geminiClient.isReady) {
            // Forward raw PCM audio chunk to Gemini
            await geminiClient.sendRealtimeAudio(data);
          }
        }
      } catch (err) {
        logger.error('[VoiceController] WS message error:', err);
      }
    });

    ws.on('close', () => {
      logger.info('[VoiceController] Client disconnected from Voice WS');
      if (geminiClient) {
        geminiClient.close();
      }
    });
  });

  logger.info('[VoiceController] Voice WebSocket Server initialized on /voice');
};

module.exports = { setupVoiceSockets };
