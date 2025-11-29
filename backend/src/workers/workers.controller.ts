import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CandlesCollectorWorker } from './candles-collector.worker';
import { OutcomeTrackerWorker } from './outcome-tracker.worker';

@ApiTags('workers')
@Controller('workers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkersController {
    constructor(
        private candlesCollectorWorker: CandlesCollectorWorker,
        private outcomeTrackerWorker: OutcomeTrackerWorker,
    ) { }

    @Post('collect-candles')
    @ApiOperation({ summary: 'Manually trigger candle collection' })
    async collectCandles() {
        await this.candlesCollectorWorker.collectNow();
        return { message: 'Candle collection started' };
    }

    @Post('track-outcomes')
    @ApiOperation({ summary: 'Manually trigger outcome tracking' })
    async trackOutcomes() {
        await this.outcomeTrackerWorker.trackOutcomes();
        return { message: 'Outcome tracking completed' };
    }
}
