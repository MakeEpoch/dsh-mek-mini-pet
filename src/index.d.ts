export type PetStatus = 'working' | 'waiting' | 'success' | 'error' | 'review';
export interface PetTask { id: string; status: PetStatus; title?: string; message?: string; revision?: string | number }
export interface TaskSnapshot extends Required<PetTask> { sequence: number }
export interface PetOptions { character?: 'xiaoyin' | 'dousha'; theme?: 'mint' | 'peach' | 'lilac'; size?: 'mini' | 'tiny' | 'small' | 'medium' | 'large'; still?: boolean; speed?: 0.75 | 1 | 1.25; interactions?: boolean; showBubble?: boolean; locked?: boolean; hidden?: boolean }
export declare class DshPet extends HTMLElement {
  readonly failure: Error | undefined;
  setErrorHandler(handler?: (error: Error) => void): void;
  attachSidebarSlot(container: HTMLElement | null): void;
  attachBrandSlot(anchor: () => Element | null, frame?: () => Element | null): void;
  detachBrandSlot(): boolean;
  measureBrandSlot(): void;
  readonly snapshot: { status: PetStatus | 'idle'; task: TaskSnapshot | null; tasks: TaskSnapshot[] };
  updateTask(task: PetTask): DshPet['snapshot'];
  dismissBubble(): void;
  removeTask(id: string): void;
  clearTasks(): void;
  configure(options?: PetOptions): void;
  readonly preferences: Required<PetOptions>;
  show(): void; hide(): void; sleep(): boolean; pat(): boolean;
  openSettings(): void; closeSettings(): void; resetPreferences(): void;
  setPosition(x: number, y: number, persist?: boolean): void;
  resetPosition(): void;
}
export declare function createPet(options?: PetOptions & { container?: HTMLElement; storageKey?: string; onOpenTask?: (task: TaskSnapshot) => void; onError?: (error: Error) => void }): {
  element: DshPet;
  updateTask(task: PetTask): DshPet['snapshot'];
  removeTask(id: string): void; clearTasks(): void;
  show(): void; hide(): void; configure(options: PetOptions): void; destroy(): void;
  openSettings(): void;
};
declare global { interface HTMLElementTagNameMap { 'dsh-pet-v7': DshPet } }
