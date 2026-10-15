import { ValidationException } from '@/common/domain/DomainException.js';

export class Money {
  private readonly _amountInPaise: bigint;
  private readonly _currency: string;

  constructor(amountInPaise: bigint | number, currency = 'INR') {
    const paise =
      typeof amountInPaise === 'number' ? BigInt(Math.round(amountInPaise)) : amountInPaise;
    if (paise < 0n) {
      throw new ValidationException('Monetary amount cannot be negative.');
    }
    this._amountInPaise = paise;
    this._currency = currency.toUpperCase();
  }

  public static fromRupees(rupees: number, currency = 'INR'): Money {
    if (rupees < 0) {
      throw new ValidationException('Monetary amount cannot be negative.');
    }
    const paise = BigInt(Math.round(rupees * 100));
    return new Money(paise, currency);
  }

  public get amountInPaise(): bigint {
    return this._amountInPaise;
  }

  public get currency(): string {
    return this._currency;
  }

  public toRupees(): number {
    return Number(this._amountInPaise) / 100;
  }

  public formatIndian(): string {
    const rupees = this.toRupees();
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: this._currency,
      maximumFractionDigits: 2,
    }).format(rupees);
  }
}
