/**
 * RAG System Service for Maitri AI
 * 
 * Implements semantic search using Amazon Titan Embeddings
 * and cosine similarity for FAQ retrieval.
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export interface RAGSystemConfig {
  faqTableName: string;
  embeddingModelId: string;
  similarityThreshold: number;
  maxResults: number;
  cacheTTL: number;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  languageCode: string;
  category: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface ContextResult {
  entries: FAQEntry[];
  relevanceScores: number[];
  retrievalTime: number;
}

/**
 * Simple in-memory cache for embeddings
 */
class EmbeddingCache {
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();

  constructor(private ttl: number) {}

  get(key: string): number[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.embedding;
  }

  set(key: string, embedding: number[]): void {
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class RAGSystem {
  private embeddingCache: EmbeddingCache;

  constructor(
    private config: RAGSystemConfig,
    private bedrockClient: BedrockRuntimeClient,
    private docClient: DynamoDBDocumentClient
  ) {
    this.embeddingCache = new EmbeddingCache(config.cacheTTL);
  }

  /**
   * Retrieve relevant context for a query
   * 
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
   */
  async retrieveContext(query: string, languageCode: string): Promise<ContextResult> {
    const startTime = Date.now();

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);

    // Search FAQ database
    const results = await this.semanticSearch(queryEmbedding, languageCode);

    const retrievalTime = Date.now() - startTime;

    return {
      entries: results.entries,
      relevanceScores: results.scores,
      retrievalTime,
    };
  }

  /**
   * Generate embedding vector for text
   * 
   * Validates: Requirement 5.1
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first (Requirement 5.6)
    const cacheKey = this.hashText(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate new embedding using Titan
    const command = new InvokeModelCommand({
      modelId: this.config.embeddingModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
      }),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const embedding = responseBody.embedding as number[];

    // Cache the embedding
    this.embeddingCache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Search FAQ database using semantic similarity
   * 
   * Validates: Requirements 5.2, 5.3, 5.5
   */
  async semanticSearch(
    queryEmbedding: number[],
    languageCode: string
  ): Promise<{ entries: FAQEntry[]; scores: number[] }> {
    // Scan FAQ table (in production, use a vector database for better performance)
    const command = new ScanCommand({
      TableName: this.config.faqTableName,
      FilterExpression: 'languageCode = :lang',
      ExpressionAttributeValues: {
        ':lang': languageCode,
      },
    });

    const response = await this.docClient.send(command);
    const faqs = (response.Items || []) as FAQEntry[];

    // Calculate similarity scores
    const scoredResults = faqs
      .map(faq => ({
        faq,
        score: this.cosineSimilarity(queryEmbedding, faq.embedding),
      }))
      .filter(result => result.score >= this.config.similarityThreshold) // Requirement 5.2
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults); // Requirement 5.3

    return {
      entries: scoredResults.map(r => r.faq),
      scores: scoredResults.map(r => r.score),
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Hash text for cache key
   */
  private hashText(text: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
