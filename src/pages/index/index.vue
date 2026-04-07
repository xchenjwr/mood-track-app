<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar title="对象" left-icon="" :placeholder="true" />
    <!-- 对象列表（两列卡片） -->
    <view v-if="sortedProfileList.length" class="profile-grid">
      <view
        class="profile-card"
        :class="{ locked: p.locked }"
        v-for="p in sortedProfileList"
        :key="p.id"
        @tap="!p.locked && enterProfile(p.id)"
        @longpress="p.locked && openUnlockAction(p)">
        <up-card
          :showHead="false"
          @tap="!p.locked && enterProfile(p.id)"
          :class="{ locked: p.locked }">
          <template #body>
            <view class="profile-body" :class="{ 'locked-content': p.locked }">
              <view class="profile-name">
                {{ p.name }}
                <text v-if="p.locked" class="lock-icon">🔒</text>
              </view>
              <view class="profile-meta">
                <text>情绪 {{ p.emos?.length || 0 }}</text>
                <text class="sep">|</text>
                <text>记录 {{ getRecordTotal(p) }}</text>
              </view>
            </view>
          </template>
        </up-card>
      </view>
    </view>
    <up-empty v-else class="no-list-data" mode="list" />
    <!-- 解锁操作菜单 -->
    <up-action-sheet
      :show="unlockActionShow"
      :actions="unlockActions"
      @select="selectUnlockAction"
      @close="unlockActionShow = false" />
    <!-- 新增对象 -->
    <up-modal
      :show="createProfileShow"
      title="新增对象"
      showCancelButton
      @confirm="confirmCreateProfile"
      @cancel="createProfileShow = false">
      <view class="modal-form">
        <up-input
          v-model="newProfileName"
          placeholder="对象名称（10字以内）"
          maxlength="10" />
        <up-textarea
          v-model="newProfileDescription"
          placeholder="对象简介（100字以内，选填）"
          maxlength="100"
          count
          :style="{ marginTop: '12px' }" />
      </view>
    </up-modal>

    <!-- 悬浮新增按钮 -->
    <view class="fab-btn" @tap="openCreateProfile">
      <up-icon name="plus" size="24" color="#fff"></up-icon>
    </view>

    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useEmoStore } from "@/stores/user";
import type { ProfileType } from "@/common/interfaces";
import CustomTabBar from "@/common/components/custom-tab-bar.vue";

const store = useEmoStore();
const { switchProfile, createProfile, updateProfileLocked } = store;
const { profileList: rawProfileList } = storeToRefs(store);

const sortedProfileList = computed(() => {
  return [...rawProfileList.value].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    return getRecordTotal(b) - getRecordTotal(a);
  });
});

const createProfileShow = ref(false);
const newProfileName = ref("");
const newProfileDescription = ref("");

// 解锁操作相关
const unlockActionShow = ref(false);
const unlockTargetId = ref(0);
const unlockTargetName = ref("");

const unlockActions = computed(() => [{ name: "解锁对象", value: 0 }]);

function openUnlockAction(p: ProfileType) {
  unlockTargetId.value = p.id;
  unlockTargetName.value = p.name;
  unlockActionShow.value = true;
}

function selectUnlockAction(e: any) {
  const v = Number(e?.value);
  unlockActionShow.value = false;
  if (v === 0) {
    confirmUnlock();
  }
}

function confirmUnlock() {
  uni.showModal({
    title: "解锁确认",
    content: `确定要解锁"${unlockTargetName.value}"吗？`,
    success: (res) => {
      if (res.confirm) {
        updateProfileLocked(unlockTargetId.value, false);
        uni.showToast({ title: "已解锁", icon: "success", duration: 2000 });
      }
    },
  });
}

function getRecordTotal(p: ProfileType) {
  return p.emos?.reduce((sum, emo) => sum + (emo.record?.length || 0), 0) || 0;
}

function openCreateProfile() {
  newProfileName.value = "";
  newProfileDescription.value = "";
  createProfileShow.value = true;
}

function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    uni.showToast({ title: "请输入对象名称", icon: "none", duration: 2000 });
    return;
  }
  createProfile(name, newProfileDescription.value);
  createProfileShow.value = false;
  uni.showToast({ title: "新增成功", icon: "success", duration: 2000 });
}

function enterProfile(id: number) {
  switchProfile(id);
  uni.navigateTo({
    url: "/pages/emo/list/list",
  });
}
</script>

<style lang="less">
.profile-grid {
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.profile-card {
  width: calc(50% - 5px);

  &.locked {
    opacity: 0.6;
  }
}
.profile-body {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.locked-content {
    opacity: 0.7;
  }
}
.profile-name {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;

  .lock-icon {
    font-size: 14px;
  }
}
.profile-meta {
  font-size: 12px;
  color: #999;
}
.sep {
  margin: 0 6px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}

.fab-btn {
  position: fixed;
  right: 24px;
  bottom: 25%;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3c9cff, #2b7fe8);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(60, 156, 255, 0.35);
  z-index: 100;

  &:active {
    transform: scale(0.92);
    opacity: 0.85;
  }
}
</style>
