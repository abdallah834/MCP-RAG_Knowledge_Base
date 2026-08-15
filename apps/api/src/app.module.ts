import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { DocumentsModule } from "./modules/documents/documents.module";
import { EmbeddingsModule } from "./modules/embeddings/embeddings.module";
import { SearchModule } from "./modules/search/search.module";
import { ChatModule } from "./modules/chat/chat.module";
import { McpModule } from "./modules/mcp/mcp.module";

@Module({
  imports: [
    // Config — loads .env at root
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.development", ".env.production"],
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // Feature modules
    DocumentsModule,
    EmbeddingsModule,
    SearchModule,
    ChatModule,
    McpModule,
  ],
})
export class AppModule {}
