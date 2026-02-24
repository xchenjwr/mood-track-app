<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="emoData?.name"
      left-icon="arrow-left"
      @left-click="goBack"
      :placeholder="true"
    />
    <view class="pd-5">
      <!-- 情绪列表 -->
      <RecordList :emoData="emoData" />
    </view>
  </view>
</template>
<script lang="ts" setup>
import { reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import type { EmoType } from "@/common/interfaces";
import { useEmoStore } from "@/stores/user";
import RecordList from "./record-list.vue";

const { getEmo } = useEmoStore();
let emoData = reactive({} as EmoType); // 情绪详情数据

onLoad((option: any) => {
  const id = Number(option.id) || 0;
  const emoItem = id && getEmo(id);
  if (emoItem) {
    emoData = emoItem;
  }
});

// 返回主页
function goBack() {
  uni.navigateTo({
    url: "/pages/index/index",
  });
}
</script>
<style lang="less">
.pd-5 {
  padding: 10px;
}
.mb-10 {
  margin-bottom: 10px;
}
</style>
