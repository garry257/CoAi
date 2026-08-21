const WebSocket = require('ws');
const { createGeminiLiveClient } = require('../services/ai/geminiLiveClient');
const logger = require('../utils/logger');
const Interview = require('../models/interview.model');
const Question = require('../models/question.model');

function buildInterviewPrompt({ role, question, interviewType, company, difficulty }) {
  return `You are a professional interview coach conducting a live verbal interview.\n\n` +
    `Role: ${role || 'Candidate'}\n` +
    `Interview type: ${interviewType || 'technical'}\n` +
    `Difficulty: ${difficulty || 'medium'}\n` +
    `Company: ${company || 'Not provided'}\n\n` +
    `Current question: "${question?.question || ''}"\n` +
    `Topic: ${question?.topic || 'General'}\n` +
    `Subtopic: ${question?.subtopic || 'General'}\n\n` +
    `Instructions:\n` +
    `- Ask the question clearly and naturally.\n` +
    `- Listen to the candidate's response.\n` +
    `- Keep replies brief and conversational.\n` +
    `- Do not reveal internal scoring or answer keys.\n` +
    `- Only ask one question at a time.\n`;
}

const setupVoiceSockets = (server) => {
  const wss = new WebSocket.Server({ server, path: '/voice' });

  wss.on('connection', (ws) => {
    logger.info('[VoiceController] Client connected to Voice WS');

    let geminiClient = null;
    let currentInterviewId = null;
    let activeQuestion = null;

    const sendJson = (payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    // Notify client immediately that Voice WS connection is active & ready
    sendJson({ type: 'ready', mode: 'connected' });

    const safeCloseSession = () => {
      if (geminiClient) {
        try {
          geminiClient.close();
        } catch (error) {
          logger.warn('[VoiceController] Error closing Gemini session:', error.message);
        }
      }
      geminiClient = null;
    };

    const bindGeminiEvents = () => {
      if (!geminiClient) return;

      geminiClient.on('ready', () => {
        logger.info('[VoiceController] Gemini Live ready');
        sendJson({ type: 'ready', mode: 'live' });
      });

      geminiClient.on('content', (text) => {
        if (!text) return;
        sendJson({ type: 'transcript', text });
      });

      geminiClient.on('audio', (audioBuffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audioBuffer, { binary: true });
        }
      });

      geminiClient.on('error', (error) => {
        logger.error('[VoiceController] Gemini Live error:', error.message || error);
        sendJson({ type: 'ready', mode: 'fallback' });
      });

      geminiClient.on('closed', () => {
        logger.warn('[VoiceController] Gemini Live connection closed');
        sendJson({ type: 'ready', mode: 'fallback' });
      });
    };

    ws.on('message', async (data, isBinary) => {
      try {
        if (!isBinary) {
          const message = JSON.parse(data.toString());

          if (message.type === 'init') {
            currentInterviewId = message.interviewId || null;
            activeQuestion = message.question || null;

            try {
              geminiClient = await createGeminiLiveClient();
              bindGeminiEvents();

              if (activeQuestion && geminiClient) {
                const prompt = buildInterviewPrompt({
                  role: message.role,
                  question: activeQuestion,
                  interviewType: message.interviewType,
                  company: message.company,
                  difficulty: message.difficulty,
                });
                await geminiClient.sendSystemInstruction(prompt);
              }
            } catch (error) {
              logger.warn('[VoiceController] Gemini Live unavailable, operating in standard Web Speech mode:', error.message);
            }

            sendJson({ type: 'session_initialized', interviewId: currentInterviewId });
            sendJson({ type: 'ready', mode: 'connected' });
          }

          if (message.type === 'update_context') {
            activeQuestion = message.question || activeQuestion;
            if (geminiClient && activeQuestion) {
              const prompt = buildInterviewPrompt({
                role: message.role,
                question: activeQuestion,
                interviewType: message.interviewType,
                company: message.company,
                difficulty: message.difficulty,
              });
              await geminiClient.sendSystemInstruction(prompt);
            }
            sendJson({ type: 'context_updated' });
          }

          if (message.type === 'client_content') {
            if (geminiClient && geminiClient.isReady) {
              await geminiClient.sendClientContent(message.text || '');
            }
          }

          if (message.type === 'terminate') {
            sendJson({ type: 'terminated' });
            safeCloseSession();
            ws.close();
          }
        } else if (geminiClient && geminiClient.isReady) {
          await geminiClient.sendRealtimeAudio(data);
        }
      } catch (error) {
        logger.error('[VoiceController] WS message handling error:', error.message);
        sendJson({ type: 'ready', mode: 'connected' });
      }
    });

    ws.on('close', () => {
      logger.info('[VoiceController] Client disconnected from Voice WS');
      safeCloseSession();
    });

    ws.on('error', (error) => {
      logger.error('[VoiceController] Voice socket error:', error.message || error);
      safeCloseSession();
    });
  });

  logger.info('[VoiceController] Voice WebSocket Server initialized on /voice');
};

module.exports = { setupVoiceSockets, buildInterviewPrompt };
