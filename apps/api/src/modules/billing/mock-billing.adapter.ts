/**
 * MockBillingAdapter — Local deterministic billing adapter implementing BillingPort.
 */
import { Injectable } from '@nestjs/common';
import type { BillingPort, CreateSubscriptionParams, BillingPortResult } from './billing.port.js';

@Injectable()
export class MockBillingAdapter implements BillingPort {
  public async createSubscription(params: CreateSubscriptionParams): Promise<BillingPortResult> {
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (params.billingInterval === 'ANNUAL') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    }

    return {
      subscriptionId: `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'ACTIVE',
      currentPeriodEnd,
    };
  }

  public async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    return true;
  }

  public async updateSubscriptionPlan(
    subscriptionId: string,
    _planTier: string,
    billingInterval: string,
  ): Promise<BillingPortResult> {
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (billingInterval === 'ANNUAL') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    }

    return {
      subscriptionId,
      status: 'ACTIVE',
      currentPeriodEnd,
    };
  }
}
