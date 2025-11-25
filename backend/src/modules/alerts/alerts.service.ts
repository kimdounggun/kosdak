import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument, AlertCondition } from '../../schemas/alert.schema';
import { AlertLog, AlertLogDocument } from '../../schemas/alert-log.schema';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(AlertLog.name) private alertLogModel: Model<AlertLogDocument>,
    private candlesService: CandlesService,
    private indicatorsService: IndicatorsService,
  ) { }

  async create(userId: string, alertData: any): Promise<AlertDocument> {
    const alert = new this.alertModel({
      ...alertData,
      userId: new Types.ObjectId(userId),
      symbolId: new Types.ObjectId(alertData.symbolId),
    });
    return alert.save();
  }

  async findUserAlerts(userId: string, active?: boolean) {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (active !== undefined) {
      filter.active = active;
    }
    return this.alertModel.find(filter).populate('symbolId').sort({ createdAt: -1 });
  }

  async findById(alertId: string): Promise<AlertDocument> {
    const alert = await this.alertModel.findById(alertId);
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  async update(userId: string, alertId: string, updateData: Partial<Alert>): Promise<AlertDocument> {
    const alert = await this.alertModel.findOneAndUpdate(
      { _id: new Types.ObjectId(alertId), userId: new Types.ObjectId(userId) },
      updateData,
      { new: true },
    );

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async delete(userId: string, alertId: string): Promise<void> {
    const result = await this.alertModel.findOneAndDelete({
      _id: new Types.ObjectId(alertId),
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Alert not found');
    }
  }

  async getAlertLogs(alertId: string, limit: number = 50) {
    return this.alertLogModel
      .find({ alertId: new Types.ObjectId(alertId) })
      .sort({ triggeredAt: -1 })
      .limit(limit);
  }

  async getAllUserAlertLogs(userId: string, limit: number = 50) {
    const alerts = await this.alertModel.find({ userId: new Types.ObjectId(userId) });
    const alertIds = alerts.map(a => a._id);

    return this.alertLogModel
      .find({ alertId: { $in: alertIds } })
      .populate({
        path: 'alertId',
        populate: { path: 'symbolId' },
      })
      .sort({ triggeredAt: -1 })
      .limit(limit);
  }

  async checkAlert(alert: AlertDocument): Promise<boolean> {
    try {
      // symbolId가 null인 경우 체크
      if (!alert.symbolId) {
        console.warn(`Alert ${alert._id} has no symbolId, skipping check`);
        return false;
      }

      // Handle both populated and non-populated symbolId
      const symbolId = alert.symbolId._id
        ? alert.symbolId._id.toString()
        : alert.symbolId.toString();

      // Get latest candle and indicators
      const latestCandle = await this.candlesService.getLatestCandle(symbolId, '5m');
      const latestIndicator = await this.indicatorsService.getLatest(symbolId, '5m');

      if (!latestCandle) {
        return false;
      }

      // Check cooldown3
      if (alert.lastTriggeredAt && alert.cooldownMinutes > 0) {
        const cooldownEnd = new Date(alert.lastTriggeredAt.getTime() + alert.cooldownMinutes * 60000);
        if (new Date() < cooldownEnd) {
          return false;
        }
      }

      const conditions = alert.conditionJson as AlertCondition[];
      const results: boolean[] = [];

      for (const condition of conditions) {
        const result = await this.evaluateCondition(condition, latestCandle, latestIndicator);
        results.push(result);
      }

      // Apply logic (all = AND, any = OR)
      const triggered = alert.conditionLogic === 'all'
        ? results.every(r => r)
        : results.some(r => r);

      if (triggered) {
        // Create log
        await this.createAlertLog(alert._id, {
          price: latestCandle.close,
          volume: latestCandle.volume,
          indicators: latestIndicator ? {
            rsi: latestIndicator.rsi,
            macd: latestIndicator.macd,
            ma20: latestIndicator.ma20,
          } : {},
        });

        // Update alert
        await this.alertModel.findByIdAndUpdate(alert._id, {
          lastTriggeredAt: new Date(),
          $inc: { triggerCount: 1 },
        });
      }

      return triggered;
    } catch (error) {
      console.error(`Error checking alert ${alert._id}:`, error);
      return false;
    }
  }

  private async evaluateCondition(
    condition: AlertCondition,
    candle: any,
    indicator: any,
  ): Promise<boolean> {
    let leftValue: number;
    let rightValue: number = condition.value || 0;

    // Get left value
    switch (condition.indicator) {
      case 'price':
        leftValue = candle.close;
        break;
      case 'volume':
        leftValue = candle.volume;
        break;
      case 'rsi':
        leftValue = indicator?.rsi || 0;
        break;
      case 'macd':
        leftValue = indicator?.macd || 0;
        break;
      case 'macdSignal':
        leftValue = indicator?.macdSignal || 0;
        break;
      case 'ma5':
        leftValue = indicator?.ma5 || 0;
        break;
      case 'ma20':
        leftValue = indicator?.ma20 || 0;
        break;
      case 'ma60':
        leftValue = indicator?.ma60 || 0;
        break;
      case 'volumeRatio':
        leftValue = indicator?.volumeRatio || 0;
        break;
      default:
        leftValue = 0;
    }

    // Evaluate operator
    switch (condition.operator) {
      case '>':
        return leftValue > rightValue;
      case '<':
        return leftValue < rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '==':
        return Math.abs(leftValue - rightValue) < 0.01;
      case 'crossAbove':
        // TODO: Implement cross detection (needs historical data)
        return leftValue > rightValue;
      case 'crossBelow':
        // TODO: Implement cross detection (needs historical data)
        return leftValue < rightValue;
      default:
        return false;
    }
  }

  private async createAlertLog(alertId: Types.ObjectId, snapshot: any): Promise<AlertLogDocument> {
    const log = new this.alertLogModel({
      alertId,
      triggeredAt: new Date(),
      snapshotJson: snapshot,
      notificationSent: false,
    });
    return log.save();
  }

  async getActiveAlerts() {
    return this.alertModel.find({ active: true }).populate('symbolId userId');
  }
}

