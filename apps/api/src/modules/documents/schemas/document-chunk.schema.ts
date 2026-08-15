import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type DocumentChunkDoc = HydratedDocument<DocumentChunk>;

@Schema({ timestamps: true })
export class DocumentChunk {
  /** Reference back to the parent document */
  @Prop({
    type: Types.ObjectId,
    ref: "KbDocument",
    required: true,
    index: true,
  })
  documentId!: Types.ObjectId;

  /** Human-readable title inherited from parent */
  @Prop({ required: true })
  documentTitle!: string;

  /** The chunk's text content */
  @Prop({ required: true })
  content!: string;

  /** Position of this chunk within the document (0-indexed) */
  @Prop({ required: true })
  chunkIndex!: number;

  /**
   * OpenAI text-embedding-3-small produces 1536-dim vectors.
   * MongoDB Atlas Vector Search indexes this field.
   */
  @Prop({ type: [Number], required: true })
  embedding!: number[];

  /** Token count estimate for the chunk */
  @Prop({ default: 0 })
  tokenCount?: number;
}

export const DocumentChunkSchema = SchemaFactory.createForClass(DocumentChunk);

// Index for fast lookup by document
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
