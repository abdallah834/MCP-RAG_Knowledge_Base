import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { DocumentsService } from "./documents.service";

@ApiTags("Documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload and ingest a document (PDF, DOCX, TXT, MD)",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  async upload(@UploadedFile() file: Express.Multer.File) {
    const doc = await this.documentsService.ingestFile(file);
    return {
      message: "Document uploaded — embedding in background",
      document: {
        id: doc._id,
        title: doc.title,
        status: doc.status,
        wordCount: doc.wordCount,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: "List all documents" })
  async findAll() {
    return this.documentsService.findAll();
  }

  @Get(":id")
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiOperation({ summary: "Get document metadata" })
  async findOne(@Param("id") id: string) {
    return this.documentsService.findById(id);
  }

  @Get(":id/chunks")
  @ApiOperation({ summary: "List all chunks for a document (sans embeddings)" })
  async getChunks(@Param("id") id: string) {
    return this.documentsService.getChunksForDocument(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a document and all its chunks" })
  async remove(@Param("id") id: string) {
    await this.documentsService.delete(id);
  }
}
