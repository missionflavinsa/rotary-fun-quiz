# AI Question Generation Backend

## Setup
1. Install Python 3.10+
2. Create virtual environment: `python -m venv venv`
3. Activate: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Unix)
4. Install deps: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and fill in API keys
6. Run: `uvicorn main:app --reload --port 8001`

## Environment Variables
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (not anon key)
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key (optional)
