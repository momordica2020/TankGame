// 全局唯一 id 生成器，所有实体共享同一个计数器
let nextId = 1;

export function getNextId(): number {
  return nextId++;
}

export function resetId(): void {
  nextId = 1;
}
