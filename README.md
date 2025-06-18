# PDF Chat -- Server (Backend)
Chat based RAG Application where you can upload one or multiple PDF files and chat with it

**Pre-requisite:** Node.js must be installed in your system and Docker must be configured and running

Step 1: Create a `.env` file to the project root

Step 2: Add
```
QDRANT_URL="http://localhost:6333"
OPENAI_API_KEY=<your-openai-api-key>
<add langsmith if you wish to>
```

Step 3: Open `terminal` and run `docker compose up -d`

Step 4: Open another `terminal` and run `npm install`

Step 5: Now run `npm run dev`

Step 6: That's it! Your PDF Chat Server is ready at: "`localhost:8000`" 

Try uploading a PDF file at `localhost:3000` and start chatting with it!
