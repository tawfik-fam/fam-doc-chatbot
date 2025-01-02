import { Router } from "express";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect } from "@lancedb/lancedb";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { Document } from "langchain/document";
import * as fs from "node:fs";
import * as path from "node:path";
import fileUpload from "express-fileupload";
// import { ChatVertexAI } from "@langchain/google-vertexai";


const routes = Router();

const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey == null || openaiApiKey == undefined) {
  throw new Error(
    "You need to provide an OPEN AI API KEY, here we read it from the OPENAI_API_KEY environment variable"
  );
}

// const modelLocation = process.env.MODEL_LOCATION;

// if (modelLocation == null || modelLocation == undefined) {
//   throw new Error(
//     "You need to provide an MODEL_LOCATION, here we read it from the MODEL_LOCATION environment variable"
//   );
// }

// const projectId = process.env.PROJECT_ID;

// if (projectId == null || projectId == undefined) {
//   throw new Error(
//     "You need to provide an projectId, here we read it from the PROJECT_ID environment variable"
//   );
// }

// const llm2 = new ChatOpenAI({
//   // modelName: "llama-3.1-405b-instruct-maas",
  // temperature: 0,
  // apiKey: openaiApiKey,
//   configuration:{
//     fetch:fetch("https://us-central1-aiplatform.googleapis.com/v1/projects/famai-443316/locations/us-central1/endpoints/openapi/chat/completions?",),
//     defaultQuery:{
//       "model": "meta/llama-3.1-405b-instruct-maas"
//     },
//     // baseURL: ``,
//     defaultHeaders: {
//       "Access-Control-Allow-Methods":"POST",
//       "Authorization": `Bearer ya29.a0AeDClZBkzhewVGqxJB2yuzwrfwq-VHDGPTpBE6uBQZkQmPvNWAuoqvgvdp2oLlrFRSKLxnb1j7jwdwicBQ-Arjh0pOZZIt4ReniS5BOxPauDgP4QsPn0KFcdL4VdT2O8lULFR2N_b5kPYaxu3rB2jQ3FsBc5a7sco_NIxov6LfG60gaCgYKAXMSARMSFQHGX2Mi1_WyQMCW07_SyMCVpCAItQ0181`,
//     },
//   },
//   // modelKwargs:{
//     // "model": "meta/llama-3.1-405b-instruct-maas",
//     // "token":`Bearer ${process.env.GOOGLE_CLOUD_TOKEN}`,
//     // "stream": true,
//     // "messages": [
//     //     {
//     //         "role": "user",
//     //         "content": "hi"
//     //     }
//     // ]
// // },
  // verbose: true,
// });
// const llm2 = new ChatVertexAI({
//   // modelName: "",
//   maxOutputTokens: 1024,
//   // projectId: projectId,
//   temperature: 0,
//   // apiKey:"AIzaSyCmsSJTxUcBFE0s8Y7F9951eV6GgdKCBPc",
//   // location:"us-central1",
//   verbose:true,
//   // endpoint: "https://us-central1-aiplatform.googleapis.com/v1/projects/famAI/locations/us-central1/publishers/meta/models/llama-3.1-405b-instruct-maas"
// });
// console.log(llm2.invoke("hi"));

const llm2 = new ChatOpenAI({ 
  model: "gpt-3.5-turbo", 
  temperature: 0, 
  apiKey: process.env.OPENAI_API_KEY,
});

var chain;
var splits;
var chunk;
var separators;
var connection;
const store = {}; // Session ID -> ChatMessageHistory
const currentDirectory = path.dirname(".");
const newDirectory = path.join(currentDirectory, "vectorStoreDB");

const SCHEMA = {
  fields: [
    {
      name: "vector",
      type: {
        typeId: 16,
        listSize: 1536,
        children: [
          {
            name: "item",
            type: { typeId: 3, precision: 1 },
            nullable: true,
          },
        ],
      },
      nullable: true,
    },
    { name: "text", type: { typeId: 5 }, nullable: true },
    { name: "source_file", type: { typeId: 5 }, nullable: true },
    {
      name: "loc",
      type: {
        typeId: 13,
        children: [
          {
            name: "lines",
            type: {
              typeId: 13,
              children: [
                {
                  name: "from",
                  type: { typeId: 3, precision: 2 },
                  nullable: true,
                },
                {
                  name: "to",
                  type: { typeId: 3, precision: 2 },
                  nullable: true,
                },
              ],
            },
            nullable: true,
          },
        ],
      },
      nullable: true,
    },
  ],
  dictionaries: {},
  metadataVersion: 4,
};

function getRandomIndex(docs) {
  const randomIndex = Math.floor(Math.random() * docs.length);
  return randomIndex;
}

// Statefully manage chat history
function getSessionHistory(sessionId) {
  if (!(sessionId in store)) {
    store[sessionId] = new ChatMessageHistory();
  }
  return store[sessionId];
}

async function initializeRetrievalChain(file, file_name) {
  var docs;
  const table_name = "doc_vectors";

  // check if the db dir exist if not create it

  if (!fs.existsSync(newDirectory)) {
    fs.mkdir(newDirectory, { recursive: true }, (err) => {
      if (err) {
        console.error("Error creating directory:", err);
      } else {
        console.log("Directory created successfully!");
      }
    });
  }
  connection = await connect(newDirectory);

  console.log(newDirectory);

  // connect to the tale

  const tableNames = await connection.tableNames();
  if (!tableNames.includes(table_name)) {
    await connection.createEmptyTable(table_name, SCHEMA);
  }

  // check th file type Load and split document

  if (file_name.includes(".docx")) {
    console.log("word file");
    console.log(file_name);

    const loader = new DocxLoader(file);
    docs = (await loader.load()).map(function (doc) {
      return new Document({
        pageContent: doc.pageContent,
        metadata: { source_file: file_name },
      });
    });
    chunk = 200;
    separators = ["\n\n\n"];
  } else if (file_name.includes(".pdf")) {
    console.log("pdf file");
    console.log(file_name);

    const singleDocPerFileLoader = new PDFLoader(file, {
      splitPages: false,
      parsedItemSeparator: " ",
    });
    docs = (await singleDocPerFileLoader.load()).map(function (doc) {
      return new Document({
        pageContent: doc.pageContent,
        metadata: { source_file: file_name },
      });
    });
    chunk = 250;
    separators = ["\n\n"];
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: chunk,
    separators: separators,
  });
  splits = await textSplitter.splitDocuments(docs);
  // console.log(
  //   "/////////////////////////////////////////////////////////////////////////////////////////"
  // );
  // console.log(splits[0]);
  // console.log(
  //   "/////////////////////////////////////////////////////////////////////////////////////////"
  // );
  // console.log(splits[1]);
  // console.log(
  //   "/////////////////////////////////////////////////////////////////////////////////////////"
  // );

  // connect with the table

  const table = await connection.openTable(table_name);
  console.log(JSON.stringify(await table.schema()));

  // create the vector store and fill it with the document splits

  const vector_store = await LanceDB.fromDocuments(
    splits,
    new OpenAIEmbeddings({apiKey:openaiApiKey}),
    { table: table }
  );

  // Create retriever

  const retriever = vector_store.asRetriever({
    k: 4,
    verbose: true
  });

  // Create prompts and conversational chain
  const contextualizeQSystemPrompt =
    "Given a chat history and the latest user question which might reference context in the chat history, "+
    "formulate a standalone question which can be understood without the chat history. Do NOT answer the question, "+
    "just reformulate it if needed and otherwise return it as is.";
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeQSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm: llm2,
    retriever: retriever,
    rephrasePrompt: contextualizeQPrompt,
  });

  const systemPrompt = `You are an assistant who answers user questions strictly from the retrieved context of a file. Your goal is to provide the user with accurate responses based only on this data.
  - Only answer questions using the file context provided.
  - If the information cannot be found in the context, respond with: I do not have that information, please provide more details.
  - After answering, always state from which file and section or title within the context you found the answer.
  - Use Five sentences maximum and keep the answer concise.

  Context:
  {context}`;
  
  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const questionAnswerChain = await createStuffDocumentsChain({
    llm: llm2,
    prompt: qaPrompt,
  });
  const ragChain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: questionAnswerChain,
  });

  const conversationalRagChain = new RunnableWithMessageHistory({
    runnable: ragChain,
    getMessageHistory: getSessionHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
    outputMessagesKey: "answer",
  });

  return conversationalRagChain;
}

routes.use(
  fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: { fileSize: 10 * 1024 * 1024 },
    safeFileNames: true,
    preserveExtension: 6,
    createParentPath: true,
    parseNested: true,
    debug: true,
    preservePath: true,
    uriDecodeFileNames: true,
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles: true,
    tempFileDir: "./uploaded_files/",
  })
);

routes.post("/upload_file", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(422).json({ message: "No files were uploaded" });
  }

  const uploadedFile = req.files.file;
  console.log(`File temp path: ${uploadedFile.tempFilePath}`);
  console.log(`File Size: ${uploadedFile.size}`);
  console.log(`File Name: ${uploadedFile.name}`);
  console.log(`File Mime Type: ${uploadedFile.mimetype}`);
  console.log("Document uploaded successfully");
  chain = await initializeRetrievalChain(
    uploadedFile.tempFilePath,
    uploadedFile.name
  ); // Initialize on first upload

  res.status(200).json({ message: "Document uploaded successfully" });
});

routes.get("/question_suggestion", async (req, res) => {
  if (chain == null) {
    return res.status(400).json({ message: "Please upload a document first" });
  }

  // Question suggestion system
  const questionSuggestionSystemPrompt = `
    Task:

    Given a chat history and a set of uploaded documents, generate a list of questions.

    Specific Requirements:

    Initial Questions for empty chat history:

    If the chat history is empty, generate 3 questions that can initiate a conversation based on the document content.
    These questions should be open-ended and encourage further discussion.
    Follow-up Questions:

    If there's an existing chat history, generate 3 relevant follow-up questions based on the last user message.
    These questions should build upon the existing conversation and delve deeper into the topic.
    Generic Opening Question:

    If no context exists, generate a generic question to initiate a conversation about the document.
    
    Output Format:
    The generated questions must be formatted as a JSON object only:
    JSON
    {{
      "questions": [
          "Question 1",
          "Question 2",
          "Question 3"
      ]
    }}
    
  `;

  const chat_history = getSessionHistory("unique_session_id").messages;

  const questionSuggestionPrompt = ChatPromptTemplate.fromMessages([
    ["system", questionSuggestionSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "Provide question suggestions."],
    new MessagesPlaceholder("docs"),
  ]);

  const ch = questionSuggestionPrompt.pipe(llm2);

  console.log(getRandomIndex(splits));
  console.log(splits[getRandomIndex(splits)]);
  
  
  const randDocs = []
  const randomIndex = [];
  if(chat_history.length == 0){
    while (randomIndex.length < 3) {
      const ranIndex = getRandomIndex(splits);
      if (!randomIndex.includes(ranIndex)){
        randomIndex.push(ranIndex);
      }
      console.log(ranIndex);
    }

    console.log(randomIndex);
    

    for (let i=0;i < randomIndex.length;i++){
      randDocs.push(splits[randomIndex[i]].pageContent);
    }
    console.log(randDocs.length);
  }

  const result = await ch.invoke({ chat_history: chat_history ,"docs": randDocs});

  console.log(result);
  
  const cleanText = result.content.replace(/```json|```/g, '').trim();

  // Parse JSON
  const jsonData = JSON.parse(cleanText);
  console.log(jsonData);
  

  // Attach the question suggestion functionality
  // const questSuggestion = async () => {
  //   const response = await llm2.generate({
  //     prompt: questionSuggestionPrompt.format(),
  //   });
  //   return response;
  // };

  // const result = await questSuggestion();

  res.status(200).json(jsonData);
});

routes.post("/chat", async (req, res) => {
  console.log(chain);

  if (chain == null) {
    return res.status(400).json({ message: "Please upload a document first" });
  }

  const query = req.body.query;

  if (query == null || query == "") {
    return res.status(400).json({ message: "Kindly ask a question!" });
  }

  if (!connection.isOpen()) {
    connection = await connect(newDirectory);
  }

  const result = await chain.invoke(
    { input: query },
    { configurable: { sessionId: "unique_session_id" } }
  );

  console.log("/////////////////////////////");

  console.log(getSessionHistory("unique_session_id").messages);

  res.status(200).send({ result: result });
});

// new arrow.Schema([
//   new arrow.Field("id", new arrow.Int32(),false),
//   new arrow.Field("vector", new arrow.FixedSizeList(1536,new arrow.Field("pageContent",new arrow.Utf8()))),
//   new arrow.Field("document", new arrow.Schema([
//     new arrow.Field("pageContent",new arrow.Utf8(),false),
//     new arrow.Field("metadata", new arrow.Schema([
//       new arrow.Field("Title",new arrow.Utf8(),true),
//     ])),
//   ])),
// ])

// const routes = Router();

// const llm2 = new ChatOpenAI({ model: "gpt-3.5-turbo", temperature: 0, apiKey: process.env.OPENAI_API_KEY});

// // const db_dir = async () => {
// //   console.log(db_path);
// //   if (fs.existsSync(db_path)) {
// //     return db_path;
// //   }else{
// //     return fs.mkdir(db_path);
// //   }
// // }

// routes.post("/upload_file", async (req, res) => {
//   console.log("i am in ");

//   // Construct retriever
//   // const loader2 = new CheerioWebBaseLoader(
//   // "https://lilianweng.github.io/posts/2023-06-23-agent/",
//   // {
//   //     selector: ".post-content, .post-title, .post-header",
//   // }
//   // );

//   const pdfPath = "./Listing Cycle Help Document .pdf";

//   const singleDocPerFileLoader = new PDFLoader(pdfPath, {
//       splitPages: false,
//       parsedItemSeparator: " ",
//     });

//   const docs2 = await singleDocPerFileLoader.load();

//   // // const docs2 = await loader2.load();

//   const textSplitter2 = new RecursiveCharacterTextSplitter({
//   chunkSize: 2000,
//   chunkOverlap: 250,
//   separators: [ "\n\n" ]

//   });
//   const splits2 = await textSplitter2.splitDocuments(docs2);

//   // const vectorstore2 = await MemoryVectorStore.fromDocuments(
//   // splits2,
//   // new OpenAIEmbeddings()
//   // );
//   // const retriever2 = vectorstore2.asRetriever({
//   //     searchType: "mmr",
//   //     searchKwargs: {
//   //       fetchK: 20,
//   //     },
//   //     k: 4,
//   //   });

//   // const db = await connect(db_path);
//   // await db.createTable("doc_vectors", splits2);
//   const vectorStore = new LanceDB.fromDocuments(splits2,new OpenAIEmbeddings());
//   const retriever = vectorStore.asRetriever({
//     k: 4,
//     verbose: true,
//     searchType: 'mmr',
//     searchKwargs: {
//       // alpha: 0.5,
//       fetchK: 20
//     },
//   });

//   // Contextualize question
//   const contextualizeQSystemPrompt2 =
//   "Given a chat history and the latest user question " +
//   "which might reference context in the chat history, " +
//   "formulate a standalone question which can be understood " +
//   "without the chat history. Do NOT answer the question, " +
//   "just reformulate it if needed and otherwise return it as is.";

//   const contextualizeQPrompt2 = ChatPromptTemplate.fromMessages([
//   ["system", contextualizeQSystemPrompt2],
//   new MessagesPlaceholder("chat_history"),
//   ["human", "{input}"],
//   ]);

//   const historyAwareRetriever2 = await createHistoryAwareRetriever({
//   llm: llm2,
//   retriever: retriever,
//   rephrasePrompt: contextualizeQPrompt2,
//   });

//   // Answer question
//   const systemPrompt2 =
//   "You are an assistant for question-answering tasks. " +
//   "Use the following pieces of retrieved context to answer " +
//   "the question. If you don't know the answer, say that you " +
//   "don't know. Use three sentences maximum and keep the " +
//   "answer concise." +
//   "\n\n" +
//   "{context}";

//   const qaPrompt2 = ChatPromptTemplate.fromMessages([
//   ["system", systemPrompt2],
//   new MessagesPlaceholder("chat_history"),
//   ["human", "{input}"],
//   ]);

//   const questionAnswerChain3 = await createStuffDocumentsChain({
//   llm2,
//   prompt: qaPrompt2,
//   });

//   const ragChain3 = await createRetrievalChain({
//   retriever: historyAwareRetriever2,
//   combineDocsChain: questionAnswerChain3,
//   });

//   // Statefully manage chat history
//   const store2 = {};

//   function getSessionHistory2(sessionId) {
//   if (!(sessionId in store2)) {
//       store2[sessionId] = new ChatMessageHistory();
//   }
//   return store2[sessionId];
//   }

//   const conversationalRagChain2 = new RunnableWithMessageHistory({
//   runnable: ragChain3,
//   getMessageHistory: getSessionHistory2,
//   inputMessagesKey: "input",
//   historyMessagesKey: "chat_history",
//   outputMessagesKey: "answer",
//   });

//   res.status(200).json("The document uploaded successfully");

// });
// // const test_dir=db_path;
// // console.log(test_dir);
// // const db = await connect(db_dir());
// // const table = await db.openTable("doc_vectors");

// routes.post("/chat", async (req, res) => {
//   const query2 = req.body.query;
//   const result = await conversationalRagChain2.invoke(
//     { input: query2 },
//     { configurable: { sessionId: "unique_session_id" } }
//   );
//   res.status(200).send({"result": result});
// });

export default routes;
