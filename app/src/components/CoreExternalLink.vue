<template>
  <a class="external-link" :href="href" :target="target" :rel="computedRel">
    <slot />
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// External links default to opening in a new tab because internal navigation
// should use vue-router's RouterLink instead of this component.
const props = withDefaults(
  defineProps<{
    href: string;
    target?: '_blank' | '_parent' | '_self' | '_top';
    rel?: string;
  }>(),
  {
    rel: undefined,
    target: '_blank'
  }
);

const computedRel = computed(() => {
  // Keep caller-provided relationship metadata intact when a specific rel is
  // needed, for example "external" or "nofollow".
  if (props.rel) {
    return props.rel;
  }

  // Links opened in a new tab should not get access to the originating window.
  // "noopener" blocks window.opener, and "noreferrer" avoids leaking the source
  // URL to the external site.
  return props.target === '_blank' ? 'noopener noreferrer' : undefined;
});
</script>
