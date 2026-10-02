import { describe, it, expect } from 'vitest';
import {
  InvalidStateTransitionException,
  ValidationException,
} from '../../../../common/domain/DomainException.js';
import { BidProject } from './BidProject.js';
import { Money } from '../value-objects/Money.js';

describe('BidProject Domain Aggregate & Value Objects', () => {
  const validProps = {
    id: 'bid-100',
    organizationId: 'org-abc',
    title: 'NHAI Highway Expansion Project',
    tenderNumber: 'NIT/NHAI/2026/042',
    tenderingAuthority: 'National Highways Authority of India',
    estimatedValue: Money.fromRupees(45000000), // ₹4.5 Crore
    submissionDeadline: new Date('2026-12-31T15:00:00Z'),
  };

  describe('Instantiation & Invariants', () => {
    it('should successfully create a BidProject in DRAFT status with version 1', () => {
      const bid = new BidProject(validProps);

      expect(bid.id).toBe('bid-100');
      expect(bid.organizationId).toBe('org-abc');
      expect(bid.title).toBe('NHAI Highway Expansion Project');
      expect(bid.status.value).toBe('DRAFT');
      expect(bid.version).toBe(1);
      expect(bid.estimatedValue.toRupees()).toBe(45000000);
      expect(bid.estimatedValue.amountInPaise).toBe(4500000000n);
    });

    it('should throw ValidationException if title is empty', () => {
      expect(() => new BidProject({ ...validProps, title: '   ' })).toThrow(ValidationException);
    });

    it('should throw ValidationException if organizationId is missing', () => {
      expect(() => new BidProject({ ...validProps, organizationId: '' })).toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException if tenderNumber is empty', () => {
      expect(() => new BidProject({ ...validProps, tenderNumber: '' })).toThrow(
        ValidationException
      );
    });
  });

  describe('State Machine Transitions', () => {
    it('should transition through the valid lifecycle: DRAFT -> QUEUED -> PROCESSING -> REVIEW_READY -> FINALIZED', () => {
      const bid = new BidProject(validProps);
      expect(bid.status.value).toBe('DRAFT');
      expect(bid.version).toBe(1);

      bid.markQueued();
      expect(bid.status.value).toBe('QUEUED');
      expect(bid.version).toBe(2);

      bid.markProcessing();
      expect(bid.status.value).toBe('PROCESSING');
      expect(bid.version).toBe(3);

      bid.markReviewReady();
      expect(bid.status.value).toBe('REVIEW_READY');
      expect(bid.version).toBe(4);

      bid.markFinalized();
      expect(bid.status.value).toBe('FINALIZED');
      expect(bid.version).toBe(5);
    });

    it('should reject invalid state transitions from DRAFT directly to FINALIZED', () => {
      const bid = new BidProject(validProps);
      expect(() => bid.markFinalized()).toThrow(InvalidStateTransitionException);
    });

    it('should reject any transition out of FINALIZED state', () => {
      const bid = new BidProject(validProps);
      bid.markQueued();
      bid.markProcessing();
      bid.markReviewReady();
      bid.markFinalized();

      expect(() => bid.markQueued()).toThrow(InvalidStateTransitionException);
      expect(() => bid.markProcessing()).toThrow(InvalidStateTransitionException);
    });

    it('should allow retry transition from FAILED to QUEUED', () => {
      const bid = new BidProject(validProps);
      bid.markQueued();
      bid.markFailed();
      expect(bid.status.value).toBe('FAILED');

      bid.markQueued();
      expect(bid.status.value).toBe('QUEUED');
    });
  });

  describe('Money Value Object', () => {
    it('should correctly convert rupees to paise and format in Indian numbering', () => {
      const money = Money.fromRupees(1500000); // ₹15 Lakhs
      expect(money.amountInPaise).toBe(150000000n);
      expect(money.toRupees()).toBe(1500000);
      expect(money.currency).toBe('INR');

      const formatted = money.formatIndian();
      expect(formatted).toContain('15,00,000');
    });

    it('should reject negative amounts', () => {
      expect(() => Money.fromRupees(-100)).toThrow(ValidationException);
      expect(() => new Money(-500n)).toThrow(ValidationException);
    });
  });
});
