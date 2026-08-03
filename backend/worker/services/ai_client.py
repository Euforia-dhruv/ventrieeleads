"""Multi-provider AI client for Python workers."""
import os
import json
import asyncio
import logging
from typing import Dict, Optional
import httpx

logger = logging.getLogger(__name__)

AI_PROVIDER = os.getenv("AI_PRIMARY_PROVIDER", os.getenv("AI_PROVIDER", "ollama"))
AI_MODEL = os.getenv("AI_MODEL", "llama3")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT_DEFAULT = "You are an expert AI assistant for lead generation, sales intelligence, and digital agency operations. Always respond with valid JSON when asked for structured data."


class AIClient:
    """Multi-provider AI client for background tasks."""

    def __init__(self):
        self.provider = AI_PROVIDER
        self.model = AI_MODEL
        self.timeout = 120

    async def generate(self, prompt: str, system_prompt: str = None, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """Generate text using the configured AI provider."""
        system_prompt = system_prompt or SYSTEM_PROMPT_DEFAULT

        try:
            if self.provider == "openai":
                return await self._call_openai(prompt, system_prompt, temperature, max_tokens)
            elif self.provider == "gemini":
                return await self._call_gemini(prompt, system_prompt, temperature, max_tokens)
            elif self.provider == "anthropic":
                return await self._call_anthropic(prompt, system_prompt, temperature, max_tokens)
            else:
                return await self._call_ollama(prompt, system_prompt, temperature, max_tokens)
        except Exception as e:
            logger.error(f"AI generation failed ({self.provider}/{self.model}): {e}")
            if self.provider != "ollama":
                logger.info("Falling back to Ollama")
                try:
                    return await self._call_ollama(prompt, system_prompt, temperature, max_tokens)
                except Exception as e2:
                    logger.error(f"Ollama fallback also failed: {e2}")
            raise

    async def generate_json(self, prompt: str, system_prompt: str = None) -> Dict:
        """Generate and parse JSON response (async)."""
        json_system = (system_prompt or SYSTEM_PROMPT_DEFAULT) + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just the JSON object."
        response = await self.generate(prompt, json_system)
        return self._parse_json(response)

    def generate_sync(self, prompt: str, system_prompt: str = None, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """Synchronous wrapper for generate()."""
        return asyncio.run(self.generate(prompt, system_prompt, temperature, max_tokens))

    def generate_json_sync(self, prompt: str, system_prompt: str = None) -> Dict:
        """Synchronous wrapper for generate_json()."""
        return asyncio.run(self.generate_json(prompt, system_prompt))

    def _parse_json(self, text: str) -> Dict:
        """Parse JSON from AI response, handling markdown code blocks."""
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI response as JSON: {cleaned[:200]}")
            return {"raw_response": text, "parse_error": True}

    async def _call_openai(self, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                json={
                    "model": self.model or "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    async def _call_gemini(self, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        model = self.model or "gemini-1.5-flash"
        url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}
            })
            response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"]

    async def _call_anthropic(self, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": self.model or "claude-3-haiku-20240307",
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": prompt}]
                },
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()["content"][0]["text"]

    async def _call_ollama(self, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        async with httpx.AsyncClient(timeout=self.timeout * 2) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": self.model or "llama3",
                    "prompt": prompt,
                    "system": system_prompt,
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "stream": False,
                }
            )
            response.raise_for_status()
            return response.json()["response"]


ai_client = AIClient()
