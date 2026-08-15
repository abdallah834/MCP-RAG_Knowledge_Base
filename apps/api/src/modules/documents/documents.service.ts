import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as fs from "fs/promises";
import * as path from "path";
import PdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { KbDocument, DocumentDoc } from "./schemas/document.schema";
import {
  DocumentChunk,
  DocumentChunkDoc,
} from "./schemas/document-chunk.schema";
import { EmbeddingsService } from "../embeddings/embeddings.service";

const CHUNK_SIZE = 500; // words per chunk
const CHUNK_OVERLAP = 50; // word overlap between chunks

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectModel(KbDocument.name) private docModel: Model<DocumentDoc>,
    @InjectModel(DocumentChunk.name)
    private chunkModel: Model<DocumentChunkDoc>,
    private embeddingsService: EmbeddingsService,
  ) {}

  // ─── Ingest ────────────────────────────────────────────────────────────────

  async ingestFile(
    file: Express.Multer.File,
    uploadedBy?: string,
  ): Promise<DocumentDoc> {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const rawText = await this.extractText(file.path, ext);

    const doc = await this.docModel.create({
      title: path.basename(file.originalname, path.extname(file.originalname)),
      originalFilename: file.originalname,
      fileType: ext,
      rawText,
      wordCount: rawText.split(/\s+/).length,
      status: "processing",
      uploadedBy,
    });

    // Chunk + embed asynchronously so the HTTP response is fast
    this.processChunksAsync(doc).catch((err) => {
      this.logger.error(
        `Chunk processing failed for ${doc._id}: ${err.message}`,
      );
    });

    return doc;
  }

  private async processChunksAsync(doc: DocumentDoc): Promise<void> {
    try {
      const chunks = this.chunkText(doc.rawText, CHUNK_SIZE, CHUNK_OVERLAP);
      this.logger.log(`Embedding ${chunks.length} chunks for "${doc.title}"`);

      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await this.embeddingsService.embedBatch(batch);

        const chunkDocs = batch.map((content, j) => ({
          documentId: doc._id,
          documentTitle: doc.title,
          content,
          chunkIndex: i + j,
          embedding: embeddings[j],
          tokenCount: Math.ceil(content.length / 4), // rough estimate
        }));

        await this.chunkModel.insertMany(chunkDocs);
      }

      await this.docModel.findByIdAndUpdate(doc._id, { status: "ready" });
      this.logger.log(`✅ Document "${doc.title}" is ready`);
    } catch (err) {
      await this.docModel.findByIdAndUpdate(doc._id, {
        status: "error",
        errorMessage: (err as Error).message,
      });
    }
  }

  // ─── Text extraction ────────────────────────────────────────────────────────

  private async extractText(filePath: string, ext: string): Promise<string> {
    const buffer = await fs.readFile(filePath);

    switch (ext) {
      case "pdf": {
        const result = await PdfParse(buffer);
        return result.text;
      }
      case "docx": {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case "txt":
      case "md":
        return buffer.toString("utf-8");
      default:
        throw new BadRequestException(`Unsupported file type: ${ext}`);
    }
  }

  // ─── Chunking ───────────────────────────────────────────────────────────────

  private chunkText(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let i = 0;

    while (i < words.length) {
      const chunk = words.slice(i, i + size).join(" ");
      chunks.push(chunk);
      i += size - overlap;
    }

    return chunks;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async findAll(): Promise<DocumentDoc[]> {
    return this.docModel
      .find()
      .select("-rawText")
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<DocumentDoc> {
    const doc = await this.docModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  async delete(id: string): Promise<void> {
    const doc = await this.findById(id);
    await this.chunkModel.deleteMany({ documentId: new Types.ObjectId(id) });
    await this.docModel.findByIdAndDelete(doc._id);
  }

  async getChunksForDocument(documentId: string): Promise<DocumentChunkDoc[]> {
    return this.chunkModel
      .find({ documentId: new Types.ObjectId(documentId) })
      .select("-embedding")
      .sort({ chunkIndex: 1 })
      .exec();
  }
}
