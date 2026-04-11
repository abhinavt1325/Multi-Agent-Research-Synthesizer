# Multi-Agent Research Synthesizer

A premium, state-of-the-art research synthesis platform powered by multi-agent AI systems. This tool orchestrates specialized agents to hunt for academic papers, identify research gaps, compare evidence, and detect contradictions, all visualized through an interactive graph explorer.

## 🚀 Overview

The Multi-Agent Research Synthesizer is designed to streamline the academic literature review process. By leveraging Large Language Models (LLMs) like Groq (Llama 3) and Google Gemini, the platform provides deep insights into complex research topics.

### Key Features
- **Intelligent Planner**: Strategizes the research workflow based on your topic.
- **Academic Hunter**: Fetches high-quality papers from Semantic Scholar, arXiv, and Crossref.
- **Evidence Comparator**: Synthesizes findings across multiple documents (2-10 files).
- **Contradiction Detector**: Identifies conflicting findings in the literature.
- **Research Gap Analyzer**: Pinpoints underexplored areas for future investigation.
- **Graph Explorer**: Visualizes relationships between papers, methods, and concepts.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Tailwind CSS, Framer Motion
- **Backend**: FastAPI (Python), Uvicorn
- **Databases**: 
- **Neo4j**: Graph database for storing research connections.
- **ChromaDB**: Vector store for semantic search and embeddings.
- **SQLite**: Local database for user authentication.

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Neo4j Instance (Local or AuraDB)
- API Keys: Groq, Google Gemini, Semantic Scholar

### 1. Repository Setup
```bash
git clone <repository-url>
cd "Multi Agent Research Syntheizer Project"
```

### 2. Backend Setup
```bash
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Create a .env file in the backend directory with:
# GROQ_API_KEY=your_key
# GEMINI_API_KEY=your_key
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=password
# SEMANTIC_SCHOLAR_API_KEY=your_key
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

---

## 🏃 Running the Application

### Start Backend
```bash
cd backend
python main.py
# Or use uvicorn:
# uvicorn main:app --reload
```

### Start Frontend
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` (by default).

---

## 📂 Project Structure

```text
├── backend/
│   ├── agents/          # AI agent implementations
│   ├── api/             # FastAPI routers and endpoints
│   ├── config/          # Configuration and settings
│   ├── neo4j/           # Graph database connection and queries
│   ├── chroma/          # Vector store integration
│   └── main.py          # Application entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Dashboard and research modules
│   │   └── services/    # API communication logic
│   └── package.json
└── README.md
```

## 📄 License
This project is licensed under the MIT License.
