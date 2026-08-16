# RAG (Retrieval-Augmented Generation) System - Implementation Guide

## Overview
The RAG system enhances interview question generation by retrieving relevant domain knowledge before asking Gemini to create questions. This ensures questions are grounded in verified information from a curated knowledge base.

---

## 1. What Gets Embedded

**Input to Embedding Process:**
- Text chunks from knowledge base documents (700 chars per chunk, with 120-char overlap)
- User query text (e.g., "What is inheritance in Java?")

**Embedding Method (Hybrid Approach):**
- **Primary**: Gemini's `text-embedding-004` model generates 768-dimensional vectors
- **Fallback**: Keyword-based TF vectors (Term Frequency) using vocabulary from documents
- TF vectors: count occurrences of each unique term in the text relative to document corpus vocabulary

**Example:**
```
Text: "Java inheritance allows subclasses to reuse parent class behavior"
Vocabulary: ["java", "inheritance", "subclass", "parent", "reuse", "behavior", ...]
TF Vector: [1, 1, 1, 1, 1, 1, 0, 0, 0, ...] (positions where terms appear)
```

---

## 2. What Gets Stored

**Vector Store Structure (per document):**
```javascript
{
  docId: "java",                    // Document ID (e.g., "java", "mern", "oop")
  topic: "Java",                    // Display name for topic
  source: "java",                   // Source document ID
  chunkIndex: 0,                    // Which chunk (0, 1, 2...)
  content: "Java is a strongly...", // Actual text (up to 700 chars)
  embedding: [0.12, -0.45, ...]     // 768-dim vector OR TF vector (150+ dims)
}
```

**Knowledge Base (7 Documents Ingested):**
1. **Java** - OOP principles, inheritance, memory management, collections
2. **MERN** - Full-stack architecture, React hooks, MongoDB, Express routing
3. **OOP** - Encapsulation, abstraction, inheritance, polymorphism, SOLID
4. **DBMS** - Schema design, transactions, ACID, normalization, SQL
5. **OS** - Process/thread management, scheduling, memory, synchronization
6. **Computer Networks** - OSI model, TCP/IP, routing, DNS, HTTP/HTTPS
7. **AI/GenAI** - Embeddings, LLMs, RAG, transformers, prompt engineering

Each document is split into chunks; total ~20-30 vector store entries.

---

## 3. What Gets Retrieved

**Retrieval Process (Semantic Search):**

```
User Query: "What is inheritance in Java?"
    ↓
Convert to Vector: TF vector of query terms
    ↓
Compare Similarity to All Chunks:
  cosine_similarity(query_vector, chunk_vector)
    ↓
Score Each Chunk (0.0 to 1.0):
  Java chunk 1:  0.85 (HIGH - contains "inheritance", "Java")
  Java chunk 2:  0.72 (MEDIUM)
  DBMS chunk:    0.15 (LOW - different topic)
    ↓
Filter & Rank:
  Keep only scores > 0
  Sort descending by score
  Return top K (default K=4)
    ↓
Result:
[
  { topic: "Java", score: 0.85, content: "..." },
  { topic: "Java", score: 0.72, content: "..." },
  { topic: "OOP", score: 0.31, content: "..." },
  { topic: "DBMS", score: 0.15, content: "..." }
]
```

**Cosine Similarity Formula:**
```
similarity = (A · B) / (||A|| × ||B||)

Where:
- A · B = sum of products of vector elements
- ||A|| = magnitude of vector A
- Result: 0 (orthogonal/unrelated) to 1 (identical)
```

---

## 4. How Context Reaches Gemini

**Context Flow (Question Generation):**

```
Interview Configuration:
  role: "Frontend Developer"
  interviewType: "Technical"
  topic: "React Hooks"
  candidateProfile: { skills: ["React", "JavaScript"], ... }
    ↓
[1] buildRetrievalQuery() creates search string:
    "Frontend Developer Technical React Hooks JavaScript ..."
    ↓
[2] retrieveRelevantContext() performs semantic search:
    Query Vector → Compare to All Chunks → Top 4-5 Results
    ↓
[3] buildRAGContext() formats retrieved results:
    """
    Topic: React
    Context: React Hooks allow functional components to manage state...
    
    ---
    
    Topic: OOP
    Context: Encapsulation in React classes vs functional hooks...
    """
    ↓
[4] buildQuestionPrompt() injects context into Gemini prompt:
    """
    RETRIEVED KNOWLEDGE CONTEXT:
    {RAG_CONTEXT_HERE}
    
    CANDIDATE PROFILE:
    Skills: React, JavaScript
    Experience: Frontend...
    
    Generate 3 interview questions...
    """
    ↓
[5] Gemini Receives Full Prompt:
    - Knowledge context (grounded facts)
    - Candidate profile (personalized context)
    - Interview configuration (role, difficulty, type)
    - Instruction to generate coherent questions
    ↓
[6] Gemini Output:
    Question 1: "Explain the dependency array in useEffect..."
    Question 2: "How would you implement custom hooks for..."
    Question 3: "What's the difference between useState and useReducer..."
    (Questions are informed by retrieved knowledge + candidate skills)
```

---

## 5. API Endpoints

### Health Check
```
GET /api/rag/health
Response: { status: "ok", topics: [...], totalDocuments: 7 }
```

### Semantic Retrieval
```
POST /api/rag/retrieve
Body: { query: "What is X?", limit: 4 }
Response: { results: [{ topic: "...", score: 0.85, content: "..." }, ...] }
```

### Generate RAG Question
```
POST /api/rag/question
Body: {
  candidateProfile: { skills: [...], frameworks: [...] },
  interviewTopic: "React",
  role: "Frontend Developer",
  interviewType: "Technical",
  difficulty: "medium"
}
Response: { question: { question: "...", whyItMatters: "..." } }
```

### Preview RAG Context
```
POST /api/rag/context
Body: (same as /question)
Response: { context: "Topic: React\nContext: ...\n\n---\n\nTopic: OOP\n..." }
```

### Ingest Custom Document
```
POST /api/rag/ingest
Body: { topic: "Custom Topic", content: "..." }
Response: { document, chunks, vectorStore }
```

---

## 6. Integration with Interview Flow

**Interview Question Generation (Updated):**

```
User starts interview:
  1. SelectsRole, InterviewType, Duration, Difficulty
  2. Dashboard fetches candidateProfile (resume analysis)
  3. Dashboard POST /api/interviews (creates Interview doc, status="planned")
  4. Dashboard POST /api/interviews/:id/start → interviewController
     a. Populates candidateProfile
     b. Calls generateInterviewQuestions() with RAG retrieval
        - buildRAGContext() pulls relevant knowledge
        - Prompt includes: RAG context + candidate skills + role
     c. Gemini generates personalized, grounded questions
     d. Questions saved to database
  5. User sees interview page with timer + first question
  6. User answers; frontend POST /api/interviews/:id/answer
  7. Controller loads next question or completes interview
```

---

## 7. Security & Limits

- **Rate Limiting**: 1000 requests per 15 minutes (dev) → tune for prod
- **Knowledge Base**: Built-in, no SQL injection risk (no queries)
- **Embeddings**: Fallback to TF if Gemini fails (no API call failure)
- **Scope**: Only authenticated users can access `/api/rag/*` (authMiddleware)

---

## 8. Testing

**Test Coverage:**
✅ Knowledge base contains 7 required topics
✅ Text chunking produces manageable pieces (700 chars)
✅ Semantic retrieval returns highest-scoring topic
✅ Cosine similarity computes correctly

Run tests:
```bash
cd backend
node --test tests/rag.service.test.js
```

---

## 9. Future Enhancements

- **Vector Database**: Replace in-memory TF with Pinecone/Weaviate for scale
- **Real Embeddings**: Cache Gemini embeddings to reduce API calls
- **Multi-language**: Extend knowledge base for Python, Java, etc.
- **Feedback Loop**: Learn from user ratings to improve retrieval quality
- **Dynamic Ingestion**: Allow users to add custom knowledge docs
