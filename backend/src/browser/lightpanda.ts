import { logger } from '../core/logger';

export interface LightpandaConfig {
  headless: boolean;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  timeout: number;
}

export interface BrowserSession {
  id: string;
  page: any;
  browser: any;
  context: any;
  createdAt: Date;
  lastUsed: Date;
}

const DEFAULT_CONFIG: LightpandaConfig = {
  headless: true,
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 30000,
};

class LightpandaBrowser {
  private sessions: Map<string, BrowserSession> = new Map();
  private config: LightpandaConfig;
  private executablePath: string;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.executablePath = process.env.LIGHTPANDA_PATH || '/usr/local/bin/lightpanda';
    logger.info(`Lightpanda browser configured with path: ${this.executablePath}`);
  }

  async launch(options?: Partial<LightpandaConfig>): Promise<any> {
    try {
      const config = { ...this.config, ...options };
      logger.info('Lightpanda browser launching', { headless: config.headless });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require('playwright');
      const browser = await chromium.launch({
        headless: config.headless,
        executablePath: this.executablePath,
      });

      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        deviceScaleFactor: config.deviceScaleFactor,
        userAgent: config.userAgent,
        locale: 'en-US',
        timezoneId: process.env.TIMEZONE || 'UTC',
      });

      const page = await context.newPage();
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.sessions.set(sessionId, {
        id: sessionId,
        page,
        browser,
        context,
        createdAt: new Date(),
        lastUsed: new Date(),
      });

      logger.info(`Lightpanda session created: ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('Lightpanda launch failed:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      return null;
    }
    session.lastUsed = new Date();
    return session;
  }

  async navigate(sessionId: string, url: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });
      logger.info(`Navigated to ${url} in session ${sessionId}`);
      return { success: true, url, title: await session.page.title() };
    } catch (error) {
      logger.error(`Navigation failed for ${url}:`, error);
      throw error;
    }
  }

  async screenshot(sessionId: string, fullPage: boolean = false): Promise<Buffer> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const buffer = await session.page.screenshot({
      fullPage,
      type: 'png',
    });

    logger.info(`Screenshot taken for session ${sessionId}`);
    return buffer;
  }

  async evaluate(sessionId: string, expression: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const result = await session.page.evaluate(expression);
    return result;
  }

  async click(sessionId: string, selector: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await session.page.click(selector, { timeout: this.config.timeout });
    logger.info(`Clicked selector ${selector} in session ${sessionId}`);
  }

  async fill(sessionId: string, selector: string, value: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await session.page.fill(selector, value, { timeout: this.config.timeout });
    logger.info(`Filled selector ${selector} in session ${sessionId}`);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      await session.context.close();
      await session.browser.close();
      this.sessions.delete(sessionId);
      logger.info(`Session closed: ${sessionId}`);
    } catch (error) {
      logger.error(`Error closing session ${sessionId}:`, error);
    }
  }

  async closeAll(): Promise<void> {
    for (const [sessionId] of this.sessions) {
      await this.closeSession(sessionId);
    }
    logger.info('All Lightpanda sessions closed');
  }

  getActiveSessions(): number {
    return this.sessions.size;
  }
}

export const lightpandaBrowser = new LightpandaBrowser();
