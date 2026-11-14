import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
     new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
   );
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // lets the browser send the login cookie
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();