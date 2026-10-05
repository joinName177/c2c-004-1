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
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    expect(wrapper.text()).toContain('托运大箱');
    expect(wrapper.text()).toContain('登机箱');
    await wrapper.get('[aria-label="托运大箱长度"]').setValue('0');
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

  it('assigns an item to a suitcase through the list select', async () => {
    const { wrapper } = render();
    const select = wrapper.get('[aria-label="指定 轻薄外套 的箱子"]');
    await select.setValue('cabin');
    expect((select.element as HTMLSelectElement).value).toBe('cabin');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    // 切换到外套所在的箱子标签页
    for (const tab of wrapper.findAll('[data-box]')) {
      await tab.trigger('click');
      if (wrapper.findAll('[data-item-id="jacket"]').length === 2) break;
    }
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0]!.trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('shows the master checklist with one row per item', () => {
    const { wrapper } = render();
    const checklist = wrapper.get('[data-testid="master-checklist"]');
    expect(checklist.text()).toContain('整趟行程总清单');
    expect(checklist.findAll('tbody tr')).toHaveLength(8);
    expect(checklist.text()).toContain('微单相机');
  });

  it('previews reallocation before deleting an occupied suitcase', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="删除 登机箱"]').trigger('click');
    const dialog = wrapper.get('[data-testid="removal-preview"]');
    expect(dialog.text()).toContain('微单相机');
    await wrapper.get('[data-testid="confirm-removal"]').trigger('click');
    expect(wrapper.find('[data-testid="removal-preview"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-suitcase-id]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('登机箱 ·');
  });

  it('deletes an empty suitcase without asking', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-testid="add-suitcase"]').trigger('click');
    expect(wrapper.findAll('[data-suitcase-id]')).toHaveLength(3);
    await wrapper.get('[aria-label="删除 行李箱 3"]').trigger('click');
    expect(wrapper.find('[data-testid="removal-preview"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-suitcase-id]')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
