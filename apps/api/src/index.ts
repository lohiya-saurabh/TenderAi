// Domain & Aggregates
export * from './common/domain/DomainException.js';
export * from './common/domain/AggregateRoot.js';
export * from './common/database/IUnitOfWork.js';
export * from './common/security/TenantContext.js';
export * from './common/security/InternalServiceGuard.js';

// Bids Module
export * from './modules/bids/domain/entities/BidProject.js';
export * from './modules/bids/domain/value-objects/BidStatus.js';
export * from './modules/bids/domain/value-objects/Money.js';
export * from './modules/bids/domain/repositories/IBidRepository.js';
export * from './modules/bids/application/CreateBidUseCase.js';
export * from './modules/bids/presentation/BidsController.js';
export * from './modules/bids/presentation/dto/CreateBidDto.js';

// Compliance Module
export * from './modules/compliance/domain/entities/ComplianceItem.js';
export * from './modules/compliance/domain/value-objects/ComplianceStatus.js';
export * from './modules/compliance/domain/value-objects/Provenance.js';
export * from './modules/compliance/domain/value-objects/ExecutionRules.js';
export * from './modules/compliance/domain/repositories/IComplianceItemRepository.js';
export * from './modules/compliance/application/BulkIngestComplianceUseCase.js';
export * from './modules/compliance/application/ReviewComplianceItemUseCase.js';
export * from './modules/compliance/application/ListComplianceItemsUseCase.js';
export * from './modules/compliance/presentation/ComplianceController.js';
export * from './modules/compliance/presentation/InternalWorkerController.js';
export * from './modules/compliance/presentation/dto/BulkIngestComplianceDto.js';
export * from './modules/compliance/presentation/dto/UpdateComplianceItemDto.js';

// Audit Module
export * from './modules/audit/domain/entities/AuditLog.js';
export * from './modules/audit/domain/repositories/IAuditRepository.js';
export * from './modules/audit/infrastructure/InMemoryAuditRepository.js';

// Persistence
export * from './infrastructure/persistence/InMemoryBidRepository.js';
export * from './infrastructure/persistence/InMemoryComplianceItemRepository.js';
