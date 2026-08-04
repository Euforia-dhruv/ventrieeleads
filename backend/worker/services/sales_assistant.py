"""AI Sales Assistant - generates outreach content using AI."""
import logging
import os
from typing import Dict, List, Optional
from worker.services.ai_client import ai_client

logger = logging.getLogger(__name__)

AGENCY_NAME = os.getenv("AGENCY_NAME", "Ventriee")
AGENCY_URL = os.getenv("AGENCY_URL", "https://ventriee.in")
AGENCY_SERVICES = os.getenv("AGENCY_SERVICES", "Web Development, AI Solutions, UI/UX Design, SEO, Digital Marketing")


class SalesAssistant:
    """AI-powered sales assistant for generating outreach content."""

    async def generate_cold_email(
        self,
        company_name: str,
        industry: str = "",
        issues: List[str] = None,
        contact_name: str = "",
        contact_email: str = "",
    ) -> Dict:
        """Generate a personalized cold email for a lead."""
        issues_text = ", ".join(issues[:5]) if issues else "outdated website, poor online presence"
        recipient = contact_name or "there"

        prompt = f"""Generate a professional cold outreach email for {AGENCY_NAME} ({AGENCY_URL}).

Target: {company_name} ({industry})
Problems detected: {issues_text}
Recipient: {recipient}

Requirements:
- Subject line (keep under 50 chars)
- Personalized opening referencing their specific issue
- Brief explanation of how we can help
- Social proof or case study mention
- Clear CTA (book a free audit call)
- Professional signature
- Keep under 150 words
- Tone: professional but friendly, not salesy

Return as JSON:
{{"subject": "...", "body": "...", "cta": "..."}}"""

        result = await ai_client.generate_json(prompt)
        return result or {
            "subject": f"Quick question about {company_name}'s website",
            "body": f"Hi {recipient},\n\nI noticed {company_name} might benefit from a website refresh. We help businesses like yours improve their online presence and convert more visitors into customers.\n\nWould you be open to a quick 15-minute call to discuss how we can help?\n\nBest regards,\n{AGENCY_NAME}\n{AGENCY_URL}",
            "cta": "Book a free 15-minute audit call"
        }

    async def generate_linkedin_message(
        self,
        company_name: str,
        industry: str = "",
        issues: List[str] = None,
        contact_name: str = "",
    ) -> Dict:
        """Generate a LinkedIn connection request + follow-up message."""
        issues_text = ", ".join(issues[:3]) if issues else "website improvements"
        recipient = contact_name or "there"

        prompt = f"""Generate LinkedIn outreach messages for {AGENCY_NAME}.

Target: {company_name} ({industry})
Issues: {issues_text}

Generate:
1. Connection request (under 300 chars)
2. First follow-up message (under 200 words)

Requirements:
- Reference their industry/company specifically
- Mention one specific issue we can solve
- No hard sell, focus on value
- CTA: share a quick insight or free audit

Return as JSON:
{{"connection_request": "...", "follow_up": "..."}}"""

        result = await ai_client.generate_json(prompt)
        return result or {
            "connection_request": f"Hi {recipient}, I help {industry} businesses improve their digital presence. I noticed some opportunities for {company_name} and wanted to connect.",
            "follow_up": f"Thanks for connecting, {recipient}! I took a quick look at {company_name}'s online presence and spotted a few ways to boost your conversions. Would you like me to share a quick analysis?"
        }

    async def generate_whatsapp_message(
        self,
        company_name: str,
        industry: str = "",
        issues: List[str] = None,
    ) -> str:
        """Generate a WhatsApp outreach message."""
        issues_text = ", ".join(issues[:2]) if issues else "website"

        prompt = f"""Generate a short WhatsApp message for {AGENCY_NAME} outreach.

Target: {company_name} ({industry})
Issue: {issues_text}

Requirements:
- Under 100 words
- Friendly, conversational tone
- Mention specific issue
- CTA: share a quick audit or example
- Include emoji sparingly (1-2 max)

Return just the message text, no JSON."""

        result = await ai_client.generate(prompt)
        return result or f"Hi! I noticed {company_name}'s {issues_text} could use some improvements. We recently helped a similar {industry} business increase their leads by 3x. Would you like me to share a quick audit?"

    async def generate_audit_summary(
        self,
        company_name: str,
        website: str,
        scores: Dict,
        issues: List[str],
        strengths: List[str],
    ) -> str:
        """Generate a client-facing audit summary."""
        scores_text = "\n".join([f"- {k}: {v}/100" for k, v in scores.items()])
        issues_text = "\n".join([f"- {i}" for i in issues[:10]])
        strengths_text = "\n".join([f"- {s}" for s in strengths[:5]])

        prompt = f"""Generate a professional website audit summary for {company_name} ({website}).

Scores:
{scores_text}

Issues found:
{issues_text}

Strengths:
{strengths_text}

Requirements:
- Professional, consultative tone
- Highlight top 3 improvements
- Explain business impact of each issue
- Include estimated ROI of fixes
- Suggest next steps
- Under 500 words

Return the summary as formatted text."""

        result = await ai_client.generate(prompt)
        return result or f"Website Audit Summary for {company_name}\n\nOverall Score: {scores.get('overall', 'N/A')}/100\n\nKey Issues:\n" + "\n".join([f"- {i}" for i in issues[:5]])

    async def generate_proposal(
        self,
        company_name: str,
        industry: str,
        issues: List[str],
        scores: Dict,
        services_needed: List[str],
        budget_range: str = "",
    ) -> Dict:
        """Generate a proposal outline with pricing."""
        issues_text = "\n".join([f"- {i}" for i in issues[:8]])
        services_text = ", ".join(services_needed)

        prompt = f"""Generate a proposal outline for {AGENCY_NAME}.

Client: {company_name} ({industry})
Issues: {issues_text}
Services needed: {services_text}
Budget range: {budget_range or "Not specified"}

Generate a proposal with:
1. Executive summary (2-3 sentences)
2. Recommended services with descriptions
3. Estimated timeline
4. Pricing tiers (Basic, Standard, Premium)
5. ROI projections
6. Why choose us (2-3 points)
7. Next steps

Return as JSON:
{{"executive_summary": "...", "services": [{{"name": "...", "description": "...", "price": "..."}}], "timeline": "...", "pricing": {{"basic": "...", "standard": "...", "premium": "..."}}, "roi": "...", "why_us": ["..."], "next_steps": "..."}}"""

        result = await ai_client.generate_json(prompt)
        return result or {
            "executive_summary": f"We propose a comprehensive digital transformation for {company_name} addressing key growth opportunities.",
            "services": [{"name": s, "description": f"Professional {s.lower()} services", "price": "Custom"} for s in services_needed[:5]],
            "timeline": "4-8 weeks",
            "pricing": {"basic": "$2,000-5,000", "standard": "$5,000-15,000", "premium": "$15,000-30,000"},
            "roi": "3-5x return within 6 months through increased leads and conversions",
            "why_us": ["Expert team with 50+ projects", "AI-powered solutions", "Proven results in " + industry],
            "next_steps": "Schedule a discovery call to finalize scope and timeline"
        }

    async def generate_followup_sequence(
        self,
        company_name: str,
        contact_name: str,
        days: List[int] = None,
    ) -> List[Dict]:
        """Generate a follow-up email sequence."""
        if days is None:
            days = [1, 3, 7, 14, 30]

        prompt = f"""Generate a {len(days)}-email follow-up sequence for {AGENCY_NAME}.

Lead: {contact_name} at {company_name}
Days: {', '.join([f'Day {d}' for d in days])}

For each email, generate:
- Subject line
- Brief body (under 100 words)
- Different angle/value prop each time
- Escalating urgency but never pushy

Return as JSON:
{{"sequence": [{{"day": 1, "subject": "...", "body": "..."}}, ...]}}"""

        result = await ai_client.generate_json(prompt)
        if result and "sequence" in result:
            return result["sequence"]

        return [
            {"day": 1, "subject": f"Quick thought about {company_name}", "body": f"Hi {contact_name}, I shared some quick insights about {company_name}'s website. Would love to hear your thoughts."},
            {"day": 3, "subject": f"{company_name} + AI opportunity", "body": f"Hi {contact_name}, I noticed {company_name} could benefit from AI automation. Here's how we helped a similar business..."},
            {"day": 7, "subject": f"Free audit for {company_name}", "body": f"Hi {contact_name}, offering a complimentary website audit for {company_name}. No strings attached."},
            {"day": 14, "subject": f"Quick question", "body": f"Hi {contact_name}, is improving {company_name}'s online presence a priority this quarter?"},
            {"day": 30, "subject": f"Last thought", "body": f"Hi {contact_name}, wanted to share one last insight before I close this out. Here's a case study relevant to {company_name}."},
        ]

    async def generate_meeting_agenda(
        self,
        company_name: str,
        industry: str,
        issues: List[str],
    ) -> Dict:
        """Generate a meeting agenda for a discovery call."""
        issues_text = ", ".join(issues[:5])

        prompt = f"""Generate a 30-minute discovery call agenda for {AGENCY_NAME}.

Client: {company_name} ({industry})
Known issues: {issues_text}

Return as JSON:
{{"agenda": [{{"time": "0-5 min", "topic": "...", "notes": "..."}}], "questions_to_ask": ["..."], "objections_to_prepare": ["..."]}}"""

        result = await ai_client.generate_json(prompt)
        return result or {
            "agenda": [
                {"time": "0-5 min", "topic": "Introduction & rapport", "notes": "Build connection"},
                {"time": "5-15 min", "topic": "Discover their challenges", "notes": "Ask about current pain points"},
                {"time": "15-20 min", "topic": "Share audit findings", "notes": "Present key issues found"},
                {"time": "20-25 min", "topic": "Propose solutions", "notes": "Outline our approach"},
                {"time": "25-30 min", "topic": "Next steps", "notes": "Schedule follow-up or proposal"},
            ],
            "questions_to_ask": [
                "What's your biggest challenge with your current website?",
                "How many leads do you get from your website monthly?",
                "What would a 2x improvement in leads mean for your business?",
            ],
            "objections_to_prepare": [
                "We're happy with our current provider",
                "We don't have the budget right now",
                "We need to think about it",
            ]
        }


sales_assistant = SalesAssistant()
