import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KbDocument, KbDocumentSchema } from './schemas/document.schema';
import { DocumentChunk, DocumentChunkSchema } from './schemas/document-chunk.schema';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import * as multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KbDocument.name, schema: KbDocumentSchema },
      { name: DocumentChunk.name, schema: DocumentChunkSchema },
    ]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: multer.diskStorage({
          destination: config.get('UPLOAD_DIR', './uploads'),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${uuidv4()}${ext}`);
          },
        }),
        limits: {
          fileSize: (config.get<number>('MAX_FILE_SIZE_MB', 20)) * 1024 * 1024,
        },
        fileFilter: (_req, file, cb) => {
          const allowed = ['.pdf', '.docx', '.txt', '.md'];
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, allowed.includes(ext));
        },
      }),
    }),
    EmbeddingsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
