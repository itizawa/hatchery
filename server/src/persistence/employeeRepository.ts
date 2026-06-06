import type { UpdateEmployeeInput } from "@hatchery/common";

export interface EmployeeRecord {
  id: string;
  displayName: string;
  role: string | null;
  isBot: boolean;
  personality: string | null;
}

export interface EmployeeRepository {
  findById(id: string): Promise<EmployeeRecord | null>;
  update(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null>;
  /** 複数 id の Employee をまとめて取得する。存在しない id は除外する（#53・定時バッチの発言者解決）。 */
  listByIds(ids: string[]): Promise<EmployeeRecord[]>;
}

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly employees: EmployeeRecord[];

  constructor(employees: EmployeeRecord[] = []) {
    this.employees = employees.map((e) => ({ ...e }));
  }

  async findById(id: string): Promise<EmployeeRecord | null> {
    const found = this.employees.find((e) => e.id === id);
    return found ? { ...found } : null;
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null> {
    const employee = this.employees.find((e) => e.id === id);
    if (!employee) return null;
    if (input.displayName !== undefined) employee.displayName = input.displayName;
    if (input.role !== undefined) employee.role = input.role;
    if (input.personality !== undefined) employee.personality = input.personality;
    return { ...employee };
  }

  async listByIds(ids: string[]): Promise<EmployeeRecord[]> {
    return ids
      .map((id) => this.employees.find((e) => e.id === id))
      .filter((e): e is EmployeeRecord => e !== undefined)
      .map((e) => ({ ...e }));
  }
}
