<template>
  <up-tabbar
    :value="currentTab"
    @change="changeTabbar"
    :fixed="true"
    :placeholder="true"
  >
    <up-tabbar-item text="首页" icon="home"></up-tabbar-item>
    <up-tabbar-item text="设置" icon="setting"></up-tabbar-item>
  </up-tabbar>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";

let currentTab = ref(0);

onLoad(() => {
  currentTab.value = getApp().globalData.currentTab || 0;
});

function changeTabbar(e) {
  currentTab.value = e;
  getApp().globalData.currentTab = e;
  switch (e) {
    case 0:
      uni.navigateTo({
        url: "/pages/index/index",
      });
      break;
    case 1:
      uni.navigateTo({
        url: "/pages/setting/setting",
      });
      break;
    default:
      break;
  }
}
</script>

<style lang="less" scoped></style>
