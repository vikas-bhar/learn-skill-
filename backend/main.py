"""
SynapsePath FastAPI Reference Backend
Mirrors the exact REST API contract served by server.ts for Python deployments:
  uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

import json
import os
import re
from typing import List, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = "gemini-4-hydrogen"

app = FastAPI(title="SynapsePath Adaptive Learning API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_ai_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")
    return genai.Client(api_key=api_key)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ProfileState(BaseModel):
    estimatedLevel: str = "Unassessed"
    confidenceScore: int = 0
    strengths: List[str] = Field(default_factory=list)
    knowledgeGaps: List[str] = Field(default_factory=list)
    turnCount: int = 0


class DiagnosticTurnRequest(BaseModel):
    topic: str
    goal: str = ""
    history: List[ChatTurn] = Field(default_factory=list)
    userMessage: str = ""
    currentProfile: Optional[ProfileState] = None


class SkillTreeRequest(BaseModel):
    topic: str
    goal: str = ""
    profile: Optional[ProfileState] = None
    history: List[ChatTurn] = Field(default_factory=list)


class VideoSearchRequest(BaseModel):
    query: str
    skillTitle: str = ""
    topic: str = ""


class VideoSummarizeRequest(BaseModel):
    videoId: str
    videoTitle: str
    channelTitle: str = ""
    topic: str = ""
    skillTitle: str = ""
    userNotesOrTranscript: str = ""


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "backend": "fastapi-python",
        "hasGeminiKey": bool(os.getenv("GEMINI_API_KEY")),
        "hasYoutubeApiKey": bool(os.getenv("YOUTUBE_API_KEY")),
    }


@app.post("/api/diagnostic/turn")
def diagnostic_turn(payload: DiagnosticTurnRequest):
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    client = get_ai_client()
    is_initial = not payload.userMessage.strip() and len(payload.history) == 0
    profile = payload.currentProfile or ProfileState()
    next_turn = 0 if is_initial else profile.turnCount + 1

    transcript = "\n".join(
        f"{'Learner' if m.role == 'user' else 'Diagnostician'}: {m.content}"
        for m in payload.history
    )

    prompt = (
        f'Start a Socratic diagnostic assessment for "{payload.topic}"'
        f'{" with goal: " + payload.goal if payload.goal else ""}. '
        "Ask ONE diagnostic question and supply 3 sample replies."
        if is_initial
        else f'Topic: "{payload.topic}"\nHistory:\n{transcript}\nLearner: "{payload.userMessage}"\n'
        f"Evaluate understanding, update strengths/knowledgeGaps, set readyForSkillTree={next_turn >= 2}, "
        "and ask ONE next probing question with 3 sample replies."
    )

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction="You are an expert adaptive curriculum diagnostician.",
            response_mime_type="application/json",
        ),
    )
    data = json.loads(response.text or "{}")
    data.setdefault("updatedProfile", {})
    data["updatedProfile"]["topic"] = payload.topic
    data["updatedProfile"]["goal"] = payload.goal
    data["updatedProfile"]["turnCount"] = next_turn
    return data


@app.post("/api/skill-tree/generate")
def generate_skill_tree(payload: SkillTreeRequest):
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    client = get_ai_client()
    profile = payload.profile or ProfileState()
    prompt = (
        f'Generate a 9-node acyclic Skill Tree DAG across tiers 1-4 for "{payload.topic}". '
        f"Level: {profile.estimatedLevel}. Strengths: {', '.join(profile.strengths)}. "
        f"Gaps: {', '.join(profile.knowledgeGaps)}. Return JSON with nodes and recommendedNextId."
    )
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    data = json.loads(response.text or "{}")
    nodes = data.get("nodes", [])
    edges = [
        {"source": src, "target": n["id"]}
        for n in nodes
        for src in n.get("prerequisites", [])
    ]
    return {
        "topic": payload.topic,
        "nodes": nodes,
        "edges": edges,
        "recommendedNextId": data.get("recommendedNextId"),
    }


@app.post("/api/videos/search")
async def search_videos(payload: VideoSearchRequest):
    search_term = (payload.query or f"{payload.topic} {payload.skillTitle}").strip()
    yt_key = os.getenv("YOUTUBE_API_KEY")
    if yt_key:
        async with httpx.AsyncClient(timeout=7.0) as http:
            resp = await http.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "type": "video",
                    "videoEmbeddable": "true",
                    "maxResults": 6,
                    "q": search_term,
                    "key": yt_key,
                },
            )
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                videos = [
                    {
                        "videoId": item["id"]["videoId"],
                        "title": item["snippet"]["title"],
                        "channelTitle": item["snippet"]["channelTitle"],
                        "publishedAt": item["snippet"]["publishedAt"][:10],
                        "description": item["snippet"]["description"],
                        "thumbnailUrl": item["snippet"]["thumbnails"]["high"]["url"],
                        "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
                        "source": "youtube_api",
                    }
                    for item in items
                    if item.get("id", {}).get("videoId")
                ]
                if videos:
                    return {"videos": videos, "provider": "youtube_data_api_v3"}

    client = get_ai_client()
    grounded = client.models.generate_content(
        model=MODEL_NAME,
        contents=f'Find 6 educational YouTube video URLs for "{search_term}".',
        config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
    )
    ids = list(dict.fromkeys(re.findall(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", grounded.text or "")))[:6]
    return {"videos": [{"videoId": vid, "url": f"https://www.youtube.com/watch?v={vid}"} for vid in ids], "provider": "gemini_search_grounding"}


@app.post("/api/videos/summarize")
def summarize_video(payload: VideoSummarizeRequest):
    client = get_ai_client()
    prompt = (
        f'Synthesize structured study notes and a Mermaid "flowchart TD" diagram for "{payload.videoTitle}" '
        f'(Skill: "{payload.skillTitle}"). Notes/Transcript: {payload.userNotesOrTranscript}'
    )
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    data = json.loads(response.text or "{}")
    data["videoId"] = payload.videoId
    data["videoTitle"] = payload.videoTitle
    return data
