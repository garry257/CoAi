const { buildKnowledgeBase, buildRAGContext, retrieveRelevantContext, ingestDocument, chunkText } = require('../services/rag/ragService');
const { generateRagQuestion } = require('../services/rag/ragQuestionGenerator');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

exports.health = async (req, res) => {
  try {
    const kb = buildKnowledgeBase();
    return apiResponse.success(res, {
      topics: kb.map((doc) => doc.topic),
      totalDocuments: kb.length,
      status: 'ok',
    }, 'RAG knowledge base is ready');
  } catch (error) {
    logger.error('[RAGController] health check failed:', error.message);
    return apiResponse.error(res, 'RAG health check failed', 500);
  }
};

exports.ingest = async (req, res) => {
  try {
    const { topic, content } = req.body || {};

    if (!content || !topic) {
      return apiResponse.error(res, 'Both topic and content are required', 400);
    }

    const result = await ingestDocument({ topic, content });
    return apiResponse.success(res, result, 'Document ingested into the knowledge base');
  } catch (error) {
    logger.error('[RAGController] ingest failed:', error.message);
    return apiResponse.error(res, error.message || 'Document ingestion failed', 500);
  }
};

exports.retrieve = async (req, res) => {
  try {
    const { query, limit = 4 } = req.body || {};

    if (!query) {
      return apiResponse.error(res, 'A query is required', 400);
    }

    const docs = buildKnowledgeBase();
    const results = retrieveRelevantContext(query, docs, Number(limit));
    return apiResponse.success(res, { results }, 'Relevant knowledge retrieved successfully');
  } catch (error) {
    logger.error('[RAGController] retrieval failed:', error.message);
    return apiResponse.error(res, error.message || 'Context retrieval failed', 500);
  }
};

exports.generateQuestion = async (req, res) => {
  try {
    const { candidateProfile, interviewTopic, role, interviewType, difficulty } = req.body || {};

    if (!candidateProfile || !interviewTopic) {
      return apiResponse.error(res, 'candidateProfile and interviewTopic are required', 400);
    }

    const question = await generateRagQuestion({
      candidateProfile,
      interviewTopic,
      role,
      interviewType,
      difficulty,
    });

    return apiResponse.success(res, { question }, 'RAG question generated successfully');
  } catch (error) {
    logger.error('[RAGController] question generation failed:', error.message);
    return apiResponse.error(res, error.message || 'RAG question generation failed', 500);
  }
};

exports.previewContext = async (req, res) => {
  try {
    const { candidateProfile, interviewTopic, role, interviewType } = req.body || {};
    const context = buildRAGContext({
      candidateProfile,
      interviewTopic,
      role,
      interviewType,
      limit: 5,
    });

    return apiResponse.success(res, { context }, 'RAG context assembled successfully');
  } catch (error) {
    logger.error('[RAGController] context assembly failed:', error.message);
    return apiResponse.error(res, error.message || 'Context assembly failed', 500);
  }
};

exports.chunkPreview = async (req, res) => {
  try {
    const { text, chunkSize = 700, overlap = 120 } = req.body || {};

    if (!text) {
      return apiResponse.error(res, 'Text is required for chunking', 400);
    }

    const chunks = chunkText(text, chunkSize, overlap);
    return apiResponse.success(res, { chunks }, 'Text chunked successfully');
  } catch (error) {
    logger.error('[RAGController] chunk preview failed:', error.message);
    return apiResponse.error(res, error.message || 'Chunking failed', 500);
  }
};
