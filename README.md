# 🌌 AlgoVision: AI-Powered Research Intelligence

> **AlgoVision** is a premium, state-of-the-art research synthesis platform that orchestrates an ensemble of specialized AI agents to transform academic literature review into a structured, visual, and actionable intelligence workflow.

---

## 🚀 The Multi-Agent Orchestration

AlgoVision leverages a swarm of specialized agents, each fine-tuned for a specific stage of the research cycle:

- **🧠 Intelligent Planner**: Strategizes the research roadmap, identifying key subtopics and search trajectories.
- **🏹 Academic Hunter**: Performs high-velocity discovery across Semantic Scholar, arXiv, and Crossref.
- **📋 Expert Paper Reader**: Distills complex papers (up to 10 at a time) into structured semantic entities.
- **⚖️ Evidence Comparator**: Cross-references findings across multiple sources to identify consensus and trends.
- **🚩 Contradiction Detector**: Pinpoints conflicting evidence and methodology shifts within the literature.
- **🧪 Research Gap Analyzer**: Surfaces "white spaces" and underexplored directions for high-impact research.

---

## 💎 Key Features

- **Dynamic Graph Explorer**: An immersive, Neo4j-powered visualization that maps paper relationships, methods, and concepts.
- **Academic Export Pipeline**: LLM-synthesized, high-fidelity PDF and DOCX exports for formal academic briefing.
- **Multi-Model Intelligence**: Seamless fallback and orchestration between Groq (Llama 3.3) and Google Gemini (3.1).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Framer Motion, React-Force-Graph |
| **Backend** | FastAPI (Python), Uvicorn, Python-Dotenv |
| **Databases** | Neo4j (Graph), SQLite (Relational) |
| **AI/LLM** | Groq (Llama 3.3 70B), Google Gemini (Flash) |

---

## ⚙️ Installation & Setup

### 1. Requirements
- **Python**: 3.9+ 
- **Node.js**: 18+
- **Neo4j**: Local instance or AuraDB

### 2. Backend Configuration
```bash
git clone <repository-url>
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# To update requirements after installing new packages:
# pip freeze > requirements.txt
```

Create a `backend/.env` file:
```env
# AI Providers
GROQ_API_KEY=your_key
GEMINI_API_KEY_PRIMARY=your_key
GEMINI_API_KEY_SECONDARY=your_key

# Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# External APIs
SEMANTIC_SCHOLAR_API_KEY=your_key
```

### 3. Frontend Configuration
```bash
cd frontend
npm install
npm run dev
```

---

## 🏃 Execution

Start the intelligence engine:
```bash
# Terminal 1 (Backend)
uvicorn main:app --reload

# Terminal 2 (Frontend)
npm run dev
```

The platform will be accessible at `http://localhost:5173`.

---

## 📂 Project Architecture

```text
├── backend/
│   ├── agents/          # Multi-agent logic (Planner/Hunter/Reader/etc.)
│   ├── api/             # FastAPI routers & endpoints
│   ├── services/        # Export logic & cross-agent utilities
│   ├── neo4j/           # Cypher queries & Graph orchestration
│   └── main.py          # Platform entry point
├── frontend/
│   ├── src/components/  # Premium UI modules
│   └── src/pages/       # Specialized agent workspaces
└── docs/                # Architecture diagrams & API documentation
```

---

## 📄 License
Licensed under the MIT License. Built for the future of academic research.
