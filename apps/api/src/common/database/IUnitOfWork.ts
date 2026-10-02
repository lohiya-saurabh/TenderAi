export interface IUnitOfWork {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export class DirectUnitOfWork implements IUnitOfWork {
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}
