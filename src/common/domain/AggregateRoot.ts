export abstract class AggregateRoot {
  protected readonly _id: string;
  protected _version: number;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: string, version = 1, createdAt?: Date, updatedAt?: Date) {
    this._id = id;
    this._version = version;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? new Date();
  }

  public get id(): string {
    return this._id;
  }

  public get version(): number {
    return this._version;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  protected incrementVersion(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }
}
