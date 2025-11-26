import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Symbol, SymbolSchema } from '../../schemas/symbol.schema';
import { UserSymbol, UserSymbolSchema } from '../../schemas/user-symbol.schema';
import { SymbolsController } from './symbols.controller';
import { SymbolsService } from './symbols.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Symbol.name, schema: SymbolSchema },
      { name: UserSymbol.name, schema: UserSymbolSchema },
    ]),
  ],
  controllers: [SymbolsController],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}



