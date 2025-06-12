import dotenv from 'dotenv'
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from "bullmq";
import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from 'openai';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Worker } from 'bullmq';
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const queue = new Queue("file-upload-queue", {
  connection: {
    // host: 'localhost',
    // port: '6379',
    url: process.env.VALKEY_URL
  },
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    return(res.json({ status: 'All Good!' }));
});

app.get('/chat', async (req,res) => {
  const userQuery = req.query.message;

  const embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    collectionName: 'pdf-docs',
  });

  const retriever = vectorStore.asRetriever({
    k: 2,
  });

  const result = await retriever.invoke(userQuery);

  const SYSTEM_PROMPT = `
    You are a helpful AI Assistant who answers user's queries based on the available context from PDF file.
    CONTEXT: ${JSON.stringify(result)}
  `;

  const chatResult = await client.chat.completions.create({
    model: "o4-mini-2025-04-16",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ],
  });

  return res.json({ message: chatResult.choices[0].message.content, docs: result });
});

app.post('/upload/pdf', upload.single('pdf'), (req, res) => {
    queue.add("file-ready", JSON.stringify({
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path
    }));
    return(res.json({ message: 'Uploaded!' }));
});

app.listen(8000, () => console.log(`Server Running on PORT: ${8000}`));

const worker = new Worker('file-upload-queue', async job => {
  const data = JSON.parse(job.data);

  const loader = new PDFLoader(data.path);
  const docs = await loader.load();
  
  const embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    collectionName: 'pdf-docs',
  });

  await vectorStore.addDocuments(docs);

}, { concurrency: 100, connection: {
    // host: 'localhost',
    // port: '6379',
    url: process.env.VALKEY_URL
}, });