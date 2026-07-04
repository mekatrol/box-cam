<template>
  <img class="image" :src="src" :alt="alt" :width="width" :height="height" />
</template>

<script setup lang="ts">
// CoreImage intentionally renders only an image. Wrap it in CoreExternalLink for
// external clickable images, or RouterLink when the image navigates inside the
// Vue application.
defineProps<{
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
}>();
</script>
