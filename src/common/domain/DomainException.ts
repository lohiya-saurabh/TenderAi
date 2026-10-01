export abstract class DomainException extends Error {
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundException extends DomainException {
  public readonly code = 'ENTITY_NOT_FOUND';
  constructor(entityName: string, id: string) {
    super(`${entityName} with ID '${id}' was not found.`);
  }
}

export class InvalidStateTransitionException extends DomainException {
  public readonly code = 'INVALID_STATE_TRANSITION';
  constructor(currentState: string, targetState: string, reason?: string) {
    super(
      `Cannot transition from '${currentState}' to '${targetState}'.${
        reason ? ` Reason: ${reason}` : ''
      }`
    );
  }
}

export class ConcurrencyConflictException extends DomainException {
  public readonly code = 'CONCURRENCY_CONFLICT';
  constructor(entityName: string, id: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict on ${entityName} '${id}': expected version ${expectedVersion}, but found version ${actualVersion}. Please refresh and retry.`
    );
  }
}

export class InvalidProvenanceException extends DomainException {
  public readonly code = 'INVALID_PROVENANCE';
  constructor(field: string, reason: string) {
    super(`Invalid provenance on field '${field}': ${reason}`);
  }
}

export class InvalidExecutionRulesException extends DomainException {
  public readonly code = 'INVALID_EXECUTION_RULES';
  constructor(reason: string) {
    super(`Invalid execution rules: ${reason}`);
  }
}

export class ValidationException extends DomainException {
  public readonly code = 'VALIDATION_FAILED';
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedTenantAccessException extends DomainException {
  public readonly code = 'UNAUTHORIZED_TENANT_ACCESS';
  constructor(message = 'Access denied for the requested tenant resource.') {
    super(message);
  }
}
