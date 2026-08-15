import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DocumentDoc = HydratedDocument<KbDocument>;

@Schema({ timestamps: true })
export class KbDocument {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  originalFilename!: string;

  @Prop({ required: true, enum: ["pdf", "docx", "txt", "md"] })
  fileType!: string;

  /** Full raw text extracted from the file */
  @Prop({ required: true })
  rawText!: string;

  /** Word / character count for quick stats */
  @Prop({ default: 0 })
  wordCount?: number;

  @Prop({ default: "processing", enum: ["processing", "ready", "error"] })
  status?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop()
  uploadedBy?: string;
}

export const KbDocumentSchema = SchemaFactory.createForClass(KbDocument);

// Using the tools provided from the Docker MCP Server, go to https://news.ycombinator.com and find the top 3 trending topics right now. Choose the most interesting one and summarize what the discussion is about.
