import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any

# 1) Imports for the new agent approach
from langchain.agents.agent_toolkits import create_sql_agent, SQLDatabaseToolkit
from langchain.agents import AgentExecutor
from langchain.sql_database import SQLDatabase  # Holds the DB connection
from langchain.llms import OpenAI

load_dotenv()
app = FastAPI()

openai_api_key = os.getenv("OPENAI_API_KEY", "")

class PromptRequest(BaseModel):
    prompt: str

# 2) Connect to the SQLite DB. For PostgreSQL or MySQL, change the URI accordingly.
db = SQLDatabase.from_uri("sqlite:///example.db")

# 3) Create the LLM
llm = OpenAI(openai_api_key=openai_api_key, temperature=0.2)

# 4) Create a "toolkit" for the SQL DB, then build an agent that can use it
toolkit = SQLDatabaseToolkit(db=db, llm=llm)
agent = create_sql_agent(
    llm=llm,
    toolkit=toolkit,
    verbose=True  # Set to False to reduce console output
)

@app.post("/ask")
async def ask_llm(request: PromptRequest) -> Any:
    """
    1) The user prompt arrives.
    2) The SQL Agent decides whether or not to run a DB query.
    3) It executes a query if needed, returning results or a normal text answer.
    """
    user_prompt = request.prompt
    result = agent.run(user_prompt)
    return {"answer": result}
