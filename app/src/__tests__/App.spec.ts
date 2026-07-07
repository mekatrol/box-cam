import { describe, it, expect } from 'vitest';

import { mount } from '@vue/test-utils';
import App from '../App.vue';

describe('App', () => {
  it('mounts the CAM workspace', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('Box CAM');
    expect(wrapper.text()).toContain('Generate NC');
    expect(wrapper.text()).toContain('5 panels ready');
  });
});
