/**
 * AI Software Engineer Portfolio Showcase:
 * Custom first-principles RAG (Retrieval-Augmented Generation) implementation.
 * 
 * This file archives the original manual implementation of text chunking, 
 * vocabulary indexing, keyword bag-of-words vector generation, and cosine similarity calculations.
 * It demonstrates deep core knowledge of vector spaces without third-party libraries.
 */

const { getGeminiClient, EMBEDDING_MODEL } = require('../../config/gemini');
const logger = require('../../utils/logger');

const KNOWLEDGE_BASE = [
  {
    id: 'java',
    topic: 'Java',
    content: `Java is a strongly typed, object-oriented programming language designed for portability and enterprise development. Core concepts include classes, objects, inheritance, polymorphism, encapsulation, abstraction, interfaces, exception handling, collections, generics, multithreading, and JVM memory management. In interviews, Java questions often focus on OOP principles, access modifiers, static vs instance members, constructors, overriding vs overloading, Java Collections Framework, HashMap, ArrayList, LinkedList, concurrency, threads, and garbage collection. Java supports both procedural and object-oriented design patterns and is commonly used in backend services and enterprise systems.`
  },
  {
    id: 'mern',
    topic: 'MERN',
    content: `MERN is a full-stack JavaScript stack using MongoDB, Express.js, React.js, and Node.js. MongoDB stores data in JSON-like documents, Express.js provides routing and middleware for the API layer, React.js renders interactive UI components, and Node.js runs JavaScript on the server. Each layer complements the others: React handles the frontend, Express handles backend routes and business logic, MongoDB stores application data, and Node provides the runtime environment. Typical interview topics include REST APIs, authentication, state management, React hooks, component design, Mongoose schema modeling, document relationships, and deployment architecture.`
  },
  {
    id: 'oop',
    topic: 'OOP',
    content: `Object-oriented programming is a design paradigm based on objects, classes, and interactions. The core principles are encapsulation, abstraction, inheritance, and polymorphism. Encapsulation combines data and methods inside a class; abstraction hides complexity; inheritance reuses logic from a parent class; polymorphism allows the same interface to behave differently in different implementations. OOP is useful for organizing large systems, reducing duplication, modeling real-world entities, and improving maintainability. Common interview questions ask about constructor chaining, method overriding, interfaces vs abstract classes, composition vs inheritance, and SOLID principles.`
  },
  {
    id: 'dbms',
    topic: 'DBMS',
    content: `A Database Management System (DBMS) manages storage, retrieval, update, and organization of structured data. Important concepts include relational schemas, tables, rows, keys, indexes, transactions, ACID properties, normalization, joins, indexing strategies, query optimization, and concurrency control. A good database design balances consistency, performance, and scalability. Interview topics often cover primary keys, foreign keys, ER models, normalization forms, SQL joins, aggregation queries, transactions, deadlocks, replication, and the difference between SQL and NoSQL data models.`
  },
  {
    id: 'os',
    topic: 'OS',
    content: `Operating systems manage hardware and software resources for a computer system. Core concepts include process management, threads, scheduling algorithms, memory management, virtual memory, paging, deadlocks, synchronization, file systems, and I/O handling. In interviews, candidates are often asked about context switching, CPU scheduling, multi-threading, semaphores, producer-consumer problems, page replacement policies, and the difference between process and thread. Operating system design focuses on resource allocation, isolation, and reliability.`
  },
  {
    id: 'computer-networks',
    topic: 'Computer Networks',
    content: `Computer networks connect devices to exchange data efficiently and reliably. Key topics include the OSI and TCP/IP models, IP addressing, subnetting, routing, switching, DNS, HTTP, HTTPS, TCP vs UDP, congestion control, sockets, NAT, firewalls, and network security. Interview questions often cover packet switching, latency, bandwidth, handshake protocols, load balancing, and common application-layer protocols like HTTP, FTP, and SMTP. Understanding network layers helps diagnose connectivity problems and design scalable distributed systems.`
  },
  {
    id: 'ai-genai',
    topic: 'AI/GenAI',
    content: `AI and Generative AI focus on systems that can learn patterns from data and generate useful outputs. Core concepts include supervised learning, unsupervised learning, embeddings, vector similarity search, prompt engineering, LLM reasoning, transformers, fine-tuning, retrieval-augmented generation (RAG), tokenization, hallucination reduction, and evaluation. In generative AI workflows, retrieval uses embeddings to match user queries to relevant documents, while the LLM combines this retrieved context with the current prompt to produce grounded responses. Interview questions often explore embeddings, prompt design, context windows, safety, and how RAG improves factuality by combining search with generation.`
  }
];

const normalizeText = (text = '') => String(text).replace(/\s+/g, ' ').trim();

const tokenize = (text) => {
  const normalized = normalizeText(text).toLowerCase();
  return normalized.match(/[a-z0-9]+(?:\.[a-z0-9]+)?/g) || [];
};

const buildVocabulary = (documents = KNOWLEDGE_BASE) => {
  const terms = new Set();
  documents.forEach((doc) => {
    tokenize(doc.content).forEach((term) => terms.add(term));
  });
  return [...terms];
};

const buildKeywordVector = (text, vocabulary) => {
  const counts = {};
  const tokens = tokenize(text);

  for (const token of tokens) {
    counts[token] = (counts[token] || 0) + 1;
  }

  return vocabulary.map((term) => counts[term] || 0);
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

function chunkText(text, chunkSize = 700, overlap = 120) {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(' ', end);
      if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) break;
    start = Math.max(start + chunkSize - overlap, end);
  }

  return chunks;
}

function retrieveRelevantContext(query, documents = KNOWLEDGE_BASE, limit = 4) {
  const vocab = buildVocabulary(documents);
  if (vocab.length === 0) return [];

  const queryVector = buildKeywordVector(normalizeText(query), vocab);

  const scored = documents.flatMap((doc) => {
    const chunks = chunkText(doc.content);
    return chunks.map((chunk, index) => ({
      id: `${doc.id}-${index}`,
      docId: doc.id,
      topic: doc.topic,
      content: chunk,
      score: cosineSimilarity(queryVector, buildKeywordVector(chunk, vocab)),
    }));
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  normalizeText,
  tokenize,
  buildVocabulary,
  buildKeywordVector,
  cosineSimilarity,
  chunkText,
  retrieveRelevantContext,
  KNOWLEDGE_BASE
};
