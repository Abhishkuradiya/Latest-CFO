export interface ReadRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
}

export interface WriteRepository<T, ID = string> {
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

export interface BaseRepository<T, ID = string> extends ReadRepository<T, ID>, WriteRepository<T, ID> {}
