<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="profileData?.name || '对象设置'"
      left-icon="arrow-left"
      @left-click="goBack"
      :placeholder="true" />

    <!-- Tabs标签 -->
    <up-tabs v-model="activeTab" :list="tabs" @change="handleTabChange" />

    <!-- 简介tab -->
    <view v-if="activeTab === 0" class="tab-content">
      <view class="section">
        <view class="section-title">对象简介</view>
        <view class="desc-editor">
          <up-textarea
            v-model="description"
            placeholder="请输入对象简介（100字以内）"
            maxlength="100"
            count
            :height="150" />
          <up-button
            type="primary"
            @click="saveDescription"
            :style="{ marginTop: '15px' }">
            保存简介
          </up-button>
        </view>
      </view>
    </view>

    <!-- 锁定tab -->
    <view v-if="activeTab === 1" class="tab-content">
      <view class="section">
        <view class="section-title">锁定状态</view>
        <view class="lock-info">
          <text class="lock-text">
            {{ profileData?.locked ? "当前对象已锁定" : "当前对象未锁定" }}
          </text>
          <text class="lock-hint">
            锁定后，该对象在列表中会置灰显示且无法进入查看
          </text>
        </view>
        <up-button
          :type="profileData?.locked ? 'error' : 'primary'"
          @click="toggleLock">
          {{ profileData?.locked ? "解锁对象" : "锁定对象" }}
        </up-button>
      </view>
    </view>

    <!-- 操作提示 -->
    <up-toast ref="toastRef"></up-toast>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { onLoad } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";
import type { ProfileType } from "@/common/interfaces";

const store = useEmoStore();
const { updateProfileDescription, updateProfileLocked } = store;
const { data } = storeToRefs(store);

let profileData = reactive<ProfileType>({} as ProfileType);
const activeTab = ref(0);
const description = ref("");
const toastRef = ref();

const tabs = [{ name: "简介" }, { name: "锁定" }];

onLoad((option: any) => {
  const id = Number(option.id) || 0;
  if (id) {
    const profile = data.value.profiles.find((p) => p.id === id);
    if (profile) {
      Object.assign(profileData, profile);
      description.value = profile.description || "";
    }
  }
});

function goBack() {
  uni.navigateBack();
}

function handleTabChange(e: any) {
  if (e && e.detail && typeof e.detail.value !== "undefined") {
    activeTab.value = e.detail.value;
  } else if (typeof e === "number") {
    activeTab.value = e;
  }
}

function saveDescription() {
  if (!profileData.id) return;
  updateProfileDescription(profileData.id, description.value);
  profileData.description = description.value;
  uni.showToast({ title: "保存成功", icon: "success", duration: 2000 });
}

function toggleLock() {
  if (!profileData.id) return;
  const newLockStatus = !profileData.locked;

  uni.showModal({
    title: newLockStatus ? "锁定确认" : "解锁确认",
    content: newLockStatus
      ? `确定要锁定"${profileData.name}"吗？锁定后将无法查看该对象的情绪数据。`
      : `确定要解锁"${profileData.name}"吗？`,
    success: (res) => {
      if (res.confirm) {
        updateProfileLocked(profileData.id, newLockStatus);
        profileData.locked = newLockStatus;
        uni.showToast({
          title: newLockStatus ? "已锁定" : "已解锁",
          icon: "success",
          duration: 2000,
        });
      }
    },
  });
}
</script>

<style lang="less" scoped>
.tab-content {
  padding: 15px;
}

.section {
  background-color: #fff;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
}

.desc-editor {
  width: 100%;
}

.lock-info {
  margin-bottom: 20px;

  .lock-text {
    display: block;
    font-size: 16px;
    color: #333;
    margin-bottom: 10px;
  }

  .lock-hint {
    display: block;
    font-size: 13px;
    color: #999;
    line-height: 1.5;
  }
}
</style>
