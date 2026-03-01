/**
 * AI Engine Service for Maitri AI
 * 
 * Implements AI-powered response generation using Amazon Bedrock Claude models
 * with RAG context, government API integration, and circuit breaker pattern.
 * 
 * Validates: Requirements 4.1-4.6, 6.1-6.6, 20.6
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface AIEngineConfig {
  haikuModelId: string;
  sonnetModelId: string;
  maxTokens: number;
  temperature: number;
  responseTimeout: number;
  governmentApiTimeout: number;
  governmentApiSecretName: string;
  circuitBreakerThreshold: number;
  circuitBreakerWindowMs: number;
  circuitBreakerResetMs: number;
}

export interface AIRequest {
  userInput: string;
  languageCode: string;
  userId: string;
  ragContext?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
}

export interface AIResponse {
  text: string;
  mode: 'online' | 'offline';
  confidence: number;
  sources?: string[];
  processingTime: number;
}

/**
 * Circuit Breaker for managing failures
 */
class CircuitBreaker {
  private failures: number[] = [];
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastOpenTime: number = 0;

  constructor(
    private threshold: number,
    private windowMs: number,
    private resetMs: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      const timeSinceOpen = Date.now() - this.lastOpenTime;
      if (timeSinceOpen >= this.resetMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      // Success - if half-open, close the circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = [];
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    
    // Remove old failures outside the window
    this.failures = this.failures.filter(time => now - time < this.windowMs);
    
    // Calculate failure rate
    const failureRate = this.failures.length / (this.windowMs / 1000);
    
    // Open circuit if threshold exceeded
    if (failureRate >= this.threshold && this.state === 'closed') {
      this.state = 'open';
      this.lastOpenTime = now;
    }
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getState(): string {
    return this.state;
  }
}

export class AIEngine {
  private circuitBreaker: CircuitBreaker;
  private governmentApiCache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(
    private config: AIEngineConfig,
    private bedrockClient: BedrockRuntimeClient,
    private secretsClient: SecretsManagerClient
  ) {
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreakerThreshold,
      config.circuitBreakerWindowMs,
      config.circuitBreakerResetMs
    );
  }

  /**
   * Generate AI response using Bedrock
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Execute through circuit breaker
      const response = await this.circuitBreaker.execute(async () => {
        return await this.generateBedrockResponse(request);
      });

      return {
        ...response,
        mode: 'online',
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Bedrock invocation failed:', error);
      
      // Circuit breaker is open or Bedrock failed - return offline mode indicator
      throw new Error('AI Engine unavailable - fallback to offline mode');
    }
  }

  /**
   * Check if online mode is available
   */
  isOnlineAvailable(): boolean {
    return !this.circuitBreaker.isOpen();
  }

  /**
   * Generate response using Bedrock Claude models
   */
  private async generateBedrockResponse(request: AIRequest): Promise<Omit<AIResponse, 'mode' | 'processingTime'>> {
    // Select model based on query complexity
    const modelId = this.selectModel(request.userInput);

    // Build prompt with RAG context
    const prompt = this.buildPrompt(request);

    // Invoke Bedrock with timeout
    const response = await this.invokeBedrockWithTimeout(modelId, prompt, request.languageCode);

    return {
      text: response.text,
      confidence: response.confidence,
      sources: response.sources,
    };
  }

  /**
   * Select appropriate Claude model based on query complexity
   * 
   * Validates: Requirements 4.1, 4.2
   */
  private selectModel(userInput: string): string {
    // Simple heuristic: use Sonnet for complex queries
    const complexityIndicators = [
      'eligibility', 'calculate', 'compare', 'explain why', 'how does',
      'पात्रता', 'गणना', 'तुलना', 'क्यों', 'कैसे',
    ];

    const isComplex = complexityIndicators.some(indicator =>
      userInput.toLowerCase().includes(indicator.toLowerCase())
    );

    return isComplex ? this.config.sonnetModelId : this.config.haikuModelId;
  }

  /**
   * Build prompt with RAG context
   * 
   * Validates: Requirement 4.3
   */
  private buildPrompt(request: AIRequest): string {
    let prompt = `You are Maitri AI, a helpful assistant for Indian government schemes and services. `;
    prompt += `Respond in ${request.languageCode} language.\n\n`;

    // Add RAG context if available
    if (request.ragContext && request.ragContext.length > 0) {
      prompt += `Relevant information:\n`;
      request.ragContext.forEach((ctx, index) => {
        prompt += `${index + 1}. Q: ${ctx.question}\n   A: ${ctx.answer}\n`;
      });
      prompt += `\n`;
    }

    prompt += `User question: ${request.userInput}\n\n`;
    prompt += `Provide a helpful, accurate response based on the information above.`;

    return prompt;
  }

  /**
   * Invoke Bedrock with timeout
   * 
   * Validates: Requirement 4.5
   */
  private async invokeBedrockWithTimeout(
    modelId: string,
    prompt: string,
    languageCode: string
  ): Promise<{ text: string; confidence: number; sources?: string[] }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Bedrock invocation timeout')), this.config.responseTimeout);
    });

    const invokePromise = this.invokeBedrock(modelId, prompt);

    const response = await Promise.race([invokePromise, timeoutPromise]);

    return response;
  }

  /**
   * Invoke Bedrock Claude model
   */
  private async invokeBedrock(
    modelId: string,
    prompt: string
  ): Promise<{ text: string; confidence: number; sources?: string[] }> {
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      text: responseBody.content[0].text,
      confidence: 0.9, // Claude doesn't provide confidence scores
      sources: ['Bedrock Claude'],
    };
  }

  /**
   * Query Government API with timeout and caching
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  async queryGovernmentAPI(apiName: string, params: Record<string, any>): Promise<any> {
    const cacheKey = `${apiName}:${JSON.stringify(params)}`;
    
    // Check cache first (Requirement 6.4)
    const cached = this.governmentApiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 86400000) { // 24 hours
      return cached.data;
    }

    try {
      // Get API credentials from Secrets Manager (Requirement 6.5)
      const credentials = await this.getGovernmentApiCredentials();
      const apiConfig = credentials[apiName];

      if (!apiConfig) {
        throw new Error(`API configuration not found: ${apiName}`);
      }

      // Make API call with timeout (Requirement 6.3)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Government API timeout')), this.config.governmentApiTimeout);
      });

      const apiPromise = this.callGovernmentAPI(apiConfig, params);
      const data = await Promise.race([apiPromise, timeoutPromise]);

      // Cache the result
      this.governmentApiCache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      // Log error and return cached data if available (Requirement 6.6)
      console.error(`Government API error for ${apiName}:`, error);
      
      if (cached) {
        console.log('Returning stale cached data due to API error');
        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Get Government API credentials from Secrets Manager
   */
  private async getGovernmentApiCredentials(): Promise<Record<string, any>> {
    const command = new GetSecretValueCommand({
      SecretId: this.config.governmentApiSecretName,
    });

    const response = await this.secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value not found');
    }

    return JSON.parse(response.SecretString);
  }

  /**
   * Call Government API
   */
  private async callGovernmentAPI(apiConfig: any, params: Record<string, any>): Promise<any> {
    // This is a placeholder - actual implementation would use fetch or axios
    // to call the government API endpoints
    
    const url = new URL(apiConfig.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
