export interface CreateAuditLogProps {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown>;
  createdAt?: Date;
}

export class AuditLog {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly userId: string;
  public readonly action: string;
  public readonly entityType: string;
  public readonly entityId: string;
  public readonly diff: Readonly<Record<string, unknown>>;
  public readonly createdAt: Date;

  constructor(props: CreateAuditLogProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.action = props.action;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.diff = Object.freeze({ ...props.diff });
    this.createdAt = props.createdAt ?? new Date();

    Object.freeze(this);
  }
}
