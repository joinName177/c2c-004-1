import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const storage = new MemoryStorage();
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(storage),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, storage, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="登机箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('assigns an item to a suitcase from the item list', async () => {
    const { wrapper } = render();
    const select = wrapper.get('[aria-label="指定 运动鞋 的箱子"]');
    await select.setValue('case-check');
    expect((select.element as HTMLSelectElement).value).toBe('case-check');
    await wrapper.get('.primary').trigger('click');
    expect(wrapper.get('[data-suitcase-plan="case-check"]').text()).toContain('托运箱');
  });

  it('previews reassignment before deleting a suitcase with items, then saves once confirmed', async () => {
    const { wrapper, storage } = render();
    await wrapper.get('[aria-label="删除箱子 登机箱"]').trigger('click');
    const dialog = wrapper.get('[data-testid="remove-suitcase-dialog"]');
    expect(dialog.text()).toContain('删除「登机箱」');
    expect(dialog.text()).toContain('微单相机');
    await wrapper.get('[data-testid="confirm-remove"]').trigger('click');
    expect(wrapper.find('[data-testid="remove-suitcase-dialog"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('登机箱长度');
    const saved = JSON.parse(storage.getItem('c2c-004.planner')!);
    expect(saved.suitcases).toHaveLength(1);
    expect(saved.items.every((item: { suitcaseId?: string }) => item.suitcaseId !== 'case-carry')).toBe(true);
  });

  it('cancelling the removal preview keeps the suitcase', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="删除箱子 登机箱"]').trigger('click');
    await wrapper.get('[data-testid="cancel-remove"]').trigger('click');
    expect(wrapper.find('[data-testid="remove-suitcase-dialog"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('登机箱');
  });

  it('shows the master checklist with per-item status', async () => {
    const { wrapper } = render();
    const checklist = wrapper.get('[data-testid="master-checklist"]');
    expect(checklist.text()).toContain('总清单');
    expect(checklist.text()).toContain('微单相机');
    expect(checklist.text()).toContain('已装');
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
