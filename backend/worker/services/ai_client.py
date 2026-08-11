"""Multi-provider AI client for Python workers with graceful fallback chain."""
import os
import json
import asyncio
import time
import logging
from typing import Dict, Optional
import httpx

logger = logging.getLogger(__name__)

AI_PROVIDER = os.getenv("AI_PRIMARY_PROVIDER", os.getenv("AI_PROVIDER", "gemini"))
AI_MODEL = os.getenv("AI_MODEL", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
OLLAMA_URL = os.getenv("OLLAMA_URL", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT_DEFAULT = (
    "You are an expert AI assistant for lead generation, sales intelligence, "
    "and digital agency operations. Always respond with valid JSON when asked for structured data."
)


class AIClient:
    """Multi-provider AI client with automatic fallback chain."""

    PROVIDER_ORDER = ["gemini", "openai", "anthropic", "ollama"]
    _rate_limit_until: float = 0

    def __init__(self):
        self.provider = AI_PROVIDER
        self.model = AI_MODEL
        self.timeout = 90

    def _available_providers(self) -> list:
        """Return ordered list of providers to try."""
        providers = []
        if GEMINI_API_KEY:
            providers.append("gemini")
        if OPENAI_API_KEY:
            providers.append("openai")
        if ANTHROPIC_API_KEY:
            providers.append("anthropic")
        if OLLAMA_URL:
            providers.append("ollama")

        # Ensure the configured provider is first
        if self.provider in providers:
            providers.remove(self.provider)
            providers.insert(0, self.provider)
        return providers

    async def generate(self, prompt: str, system_prompt: str = None, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        system_prompt = system_prompt or SYSTEM_PROMPT_DEFAULT
        providers = self._available_providers()
        if not providers:
            raise RuntimeError("No AI providers configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")

        last_error = None
        for provider in providers:
            # Skip if recently rate-limited on this provider
            if provider == "gemini" and time.time() < self._rate_limit_until:
                continue
            try:
                if provider == "openai":
                    return await self._call_openai(prompt, system_prompt, temperature, max_tokens)
                elif provider == "gemini":
                    return await self._call_gemini(prompt, system_prompt, temperature, max_tokens)
                elif provider == "anthropic":
                    return await self._call_anthropic(prompt, system_prompt, temperature, max_tokens)
                elif provider == "ollama":
                    return await self._call_ollama(prompt, system_prompt, temperature, max_tokens)
            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code == 429:
                    self._rate_limit_until = time.time() + 60
                    logger.warning(f"AI provider '{provider}' rate-limited (429), cooling down 60s")
                else:
                    logger.warning(f"AI provider '{provider}' HTTP error: {e.response.status_code}")
                continue
            except Exception as e:
                last_error = e
                logger.debug(f"AI provider '{provider}' failed: {e}")
                continue

        configured_keys = []
        if GEMINI_API_KEY: configured_keys.append("GEMINI_API_KEY")
        if OPENAI_API_KEY: configured_keys.append("OPENAI_API_KEY")
        if ANTHROPIC_API_KEY: configured_keys.append("ANTHROPIC_API_KEY")

        logger.warning(
            f"All AI providers failed ({len(providers)} tried). Configured: {configured_keys}. "
            f"Last error: {last_error}"
        )
        raise RuntimeError(f"All AI providers failed: {last_error}")

    async def generate_json(self, prompt: str, system_prompt: str = None) -> Dict:
        json_system = (system_prompt or SYSTEM_PROMPT_DEFAULT) + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just the JSON object."
        try:
            response = await self.generate(prompt, json_system)
            return self._parse_json(response)
        except RuntimeError:
            return {"parse_error": True, "raw_response": ""}

    def generate_sync(self, prompt: str, system_prompt: str = None, temperature: float = 0.7, max_tokens: int = 4096) -> str:
        return asyncio.run(self.generate(prompt, system_prompt, temperature, max_tokens))

    def generate_json_sync(self, prompt: str, system_prompt: str = None) -> Dict:
        return asyncio.run(self.generate_json(prompt, system_prompt))

    def _parse_json(self, text: str) -> Dict:
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

    async def _call_openai(self, prompt, system_prompt, temperature, max_tokens):
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                json={
                    "model": self.model or "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    async def _call_gemini(self, prompt, system_prompt, temperature, max_tokens):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        model = self.model or "gemini-flash-latest"
        url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={GEMINI_API_KEY}"
        # Use higher max_tokens because thinking models consume tokens for internal reasoning
        actual_max = max(max_tokens, 1024)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": temperature, "maxOutputTokens": actual_max},
            })
            response.raise_for_status()
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates in response")
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            # Filter out "thinking" parts, get actual text
            for part in parts:
                text = part.get("text", "")
                if text and not part.get("thought", False):
                    return text
            # If all parts are thoughts, return the last part
            if parts:
                return parts[-1].get("text", "")
            raise ValueError("No text in response")

    async def _call_anthropic(self, prompt, system_prompt, temperature, max_tokens):
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not configured")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": self.model or "claude-3-haiku-20240307",
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": prompt}],
                },
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()["content"][0]["text"]

    async def _call_ollama(self, prompt, system_prompt, temperature, max_tokens):
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
                },
            )
            response.raise_for_status()
            return response.json()["response"]


ai_client = AIClient()
