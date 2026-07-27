import axios from 'axios';
import { logger } from '../core/logger';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AISettings {
  provider: 'openai' | 'gemini' | 'ollama' | 'anthropic';
  model: string;
 apiKey: string;
 baseUrl: string;
  temperature: number;
  maxTokens: number;
}

class AIIntegration {
  private settings: AISettings;

  constructor() {
    this.settings = {
      provider: (process.env.AI_PROVIDER as AISettings['provider']) || 'ollama',
      model: process.env.AI_MODEL || 'llama3',
      apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 4096
    };
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const { provider, model, baseUrl, apiKey, temperature, maxTokens } = this.settings;

    logger.info(`AIIntegration: Generating text using ${provider}/${model}`);

    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(prompt, systemPrompt, temperature, maxTokens);
        case 'gemini':
          return await this.callGemini(prompt, systemPrompt, temperature, maxTokens);
        case 'ollama':
          return await this.callOllama(prompt, systemPrompt, model, temperature, maxTokens);
        case 'anthropic':
          return await this.callAnthropic(prompt, systemPrompt, temperature, maxTokens);
        default:
          return await this.callOllama(prompt, systemPrompt, model, temperature, maxTokens);
      }
    } catch (error) {
      logger.error('AI generation failed:', error);
      throw error;
    }
  }

  async generateEmail(leadData: Record<string, any>, industry: string, context?: string): Promise<{ subject: string; body: string }> {
    const prompt = `Write a professional cold outreach email for a ${industry} business called "${leadData.company_name}" in ${leadData.location || 'the UAE'}.
${context || ''}
The email should be concise, personalized, and include a clear call-to-action. Tone: professional but friendly. Length: medium.

Respond in JSON format with "subject" and "body" fields.`;

    const response = await this.generateText(prompt);
    try {
      const parsed = JSON.parse(response.trim().replace(/```json\n?/, '').replace(/```\n?/, ''));
      return { subject: parsed.subject || 'Partnership Opportunity', body: parsed.body || response };
    } catch {
      return { subject: `Partnership Opportunity for ${leadData.company_name}`, body: response };
    }
  }

  async generateProposal(leadData: Record<string, any>, auditResult: any): Promise<string> {
    const prompt = `Write a professional proposal for ${leadData.company_name} based on the following audit results:
${JSON.stringify(auditResult, null, 2)}

The proposal should include:
1. Executive summary
2. Recommended scope of work
3. Timeline
4. Pricing estimate
5. Expected ROI

Format as a professional business document.`;

    return await this.generateText(prompt);
  }

  async scoreLead(leadData: Record<string, any>, auditResult: any): Promise<{ score: number; reasoning: string }> {
    const prompt = `Score this lead on a scale of 0-100 based on the following data:
Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Location: ${leadData.location || 'Unknown'}
Website: ${leadData.company_website || ''}
Audit Results: ${JSON.stringify(auditResult)}

Consider: revenue potential, urgency, fit with target market, competition in the area, and website quality.

Respond with JSON format: {"score": <number>, "reasoning": "<explanation>"}`;

    const response = await this.generateText(prompt);
    try {
      const parsed = JSON.parse(response.trim().replace(/```json\n?/, '').replace(/```\n?/, ''));
      return { score: parsed.score || 0, reasoning: parsed.reasoning || '' };
    } catch {
      return { score: 50, reasoning: 'Default scoring - AI parsing failed' };
    }
  }

  private async callOpenAI(prompt: string, systemPrompt: string | undefined, temperature: number, maxTokens: number): Promise<string> {
    const response = await axios.post(
      `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`,
      {
        model: this.settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI assistant for lead generation and sales.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0].message.content;
  }

  private async callGemini(prompt: string, systemPrompt: string | undefined, temperature: number, maxTokens: number): Promise<string> {
    const model = this.settings.model || 'gemini-1.5-flash';
    const url = `${process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent?key=${this.settings.apiKey}`;

    const response = await axios.post(
      url,
      {
        contents: [{
          parts: [{ text: prompt }],
          systemInstruction: { parts: [{ text: systemPrompt || 'You are a helpful AI assistant for lead generation and sales.' }] }
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      },
      { timeout: 30000 }
    );

    return response.data.candidates[0].content.parts[0].text;
  }

  private async callOllama(prompt: string, systemPrompt: string | undefined, model: string, temperature: number, maxTokens: number): Promise<string> {
    const response = await axios.post(
      `${this.settings.baseUrl}/api/generate`,
      {
        model,
        prompt,
        system: systemPrompt || 'You are a helpful AI assistant for lead generation and sales.',
        temperature,
        num_predict: maxTokens,
        stream: false
      },
      { timeout: 60000 }
    );

    return response.data.response;
  }

  private async callAnthropic(prompt: string, systemPrompt: string | undefined, temperature: number, maxTokens: number): Promise<string> {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: this.settings.model || 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || 'You are a helpful AI assistant for lead generation and sales.',
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.content[0].text;
  }
}

export const aiIntegration = new AIIntegration();
export type { AISettings };
