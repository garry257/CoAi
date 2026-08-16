const test = require('node:test');
const assert = require('node:assert/strict');

const { buildKnowledgeBase, chunkText, cosineSimilarity, retrieveRelevantContext } = require('../services/rag/ragService');

test('knowledge base contains the required topics', () => {
  const knowledgeBase = buildKnowledgeBase();
  const topics = knowledgeBase.map((doc) => doc.topic);

  assert.deepEqual(
    topics.sort(),
    ['AI/GenAI', 'Computer Networks', 'DBMS', 'Java', 'MERN', 'OS', 'OOP'].sort()
  );
});

test('text is chunked into manageable pieces', () => {
  const text = 'Java is a compiled language. It supports OOP. Java classes are used for abstraction and encapsulation.';
  const chunks = chunkText(text, 40);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length > 0));
});

test('semantic retrieval returns the closest relevant topic', () => {
  const docs = [
    { id: 'java', topic: 'Java', content: 'Java is a strongly typed language with classes, inheritance, and garbage collection.' },
    { id: 'dbms', topic: 'DBMS', content: 'A DBMS manages data storage, indexing, transactions, and concurrency.' },
  ];

  const results = retrieveRelevantContext('What is inheritance in Java?', docs, 1);

  assert.equal(results[0].topic, 'Java');
  assert.ok(results[0].score > 0.3);
});

test('cosine similarity works for aligned vectors', () => {
  const a = [1, 0, 0];
  const b = [1, 0, 0];
  assert.ok(Math.abs(cosineSimilarity(a, b) - 1) < 1e-9);
});
