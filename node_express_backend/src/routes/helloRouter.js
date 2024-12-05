import { Router } from "express";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
// import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { Document } from "langchain/document";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "node:path";
import os from "node:os";
import * as fs from "node:fs";




const routes = Router();

routes.get("/", async (req, res) => {
  // const pp = path.dirname("jjjj1");
  // const db_path = path.join(".\\lance\\");
  // console.log(db_path);
  
  // if(fs.existsSync(db_path)){
    
  //   console.log(fs.existsSync(db_path));
  // }else{
    
  // }
  // const loader = new TextLoader("test.txt");
  // const docs = await loader.load();
  // const pdfPath = "Listing Cycle Help Document .pdf";
  // // const pdfPath = "Listing Cycle Help Document .docx";
  // const singleDocPerFileLoader = new PDFLoader(pdfPath, {
  //   splitPages: false,
  //   parsedItemSeparator: " ",
  // });
  // const docs = (await singleDocPerFileLoader.load()).map(function(doc){
  //   return new Document({ pageContent:doc.pageContent,metadata:{title:doc.metadata.pdf.info.Title}});
  // });

// const loader = new DocxLoader(pdfPath);

// const docs = await loader.load();
// const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 250, separators: ["\n\n"] });
// const splits = await textSplitter.splitDocuments(docs);
  
  // const vectorStore = await LanceDB.fromDocuments(docs, new OpenAIEmbeddings());

  // const resultOne = await vectorStore.similaritySearch("hello world", 1);
  // console.log(resultOne);
  res.status(200).send({ message:"trye"});
});

export default routes;
