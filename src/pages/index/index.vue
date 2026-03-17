<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      title="对象"
      left-icon=""
      right-icon="plus-circle"
      @right-click="openCreateProfile"
      :placeholder="true"
    />
    <!-- 对象列表（两列卡片） -->
    <view v-if="profileList.length" class="profile-grid">
      <view
        class="profile-card"
        v-for="p in profileList"
        :key="p.id"
        @tap="enterProfile(p.id)"
        @longpress="openProfileActions(p)"
      >
        <up-card :showHead="false" @tap="enterProfile(p.id)">
          <template #body>
            <view class="profile-body">
              <view class="profile-name">
                {{ p.name }}
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
    <!-- 对象操作 -->
    <up-action-sheet
      :show="profileActionsShow"
      :actions="profileActions"
      @select="selectProfileAction"
      @close="profileActionsShow = false"
    />
    <!-- 修改对象名称 -->
    <up-modal
      :show="editProfileShow"
      title="修改对象名称"
      showCancelButton
      @confirm="confirmEditProfile"
      @cancel="editProfileShow = false"
    >
      <view class="pd-15">
        <up-input
          v-model="editProfileName"
          placeholder="对象名称（10字以内）"
          maxlength="10"
        />
      </view>
    </up-modal>
    <!-- 新增对象 -->
    <up-modal
      :show="createProfileShow"
      title="新增对象"
      showCancelButton
      @confirm="confirmCreateProfile"
      @cancel="createProfileShow = false"
    >
      <view class="pd-15">
        <up-input
          v-model="newProfileName"
          placeholder="对象名称（10字以内）"
          maxlength="10"
        />
      </view>
    </up-modal>
    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { storeToRefs } from "pinia";
import { useEmoStore } from "@/stores/user";
import type { ProfileType } from "@/common/interfaces";
import CustomTabBar from "@/common/components/custom-tab-bar.vue";

const store = useEmoStore();
const { switchProfile, createProfile, updateProfileName, deleteProfile } = store;
const { profileList, data } = storeToRefs(store);

const createProfileShow = ref(false);
const newProfileName = ref("");

const profileActionsShow = ref(false);
const editProfileShow = ref(false);
const editProfileName = ref("");
const selectedProfile = reactive<ProfileType>({} as ProfileType);

const profileActions = computed(() => {
  return [
    { name: "修改名称", value: 0 },
    { name: "删除对象", value: 1 },
  ];
});

function getRecordTotal(p: ProfileType) {
  return (
    p.emos?.reduce((sum, emo) => sum + (emo.record?.length || 0), 0) || 0
  );
}

function openProfileActions(p: ProfileType) {
  selectedProfile.id = p.id;
  selectedProfile.name = p.name;
  selectedProfile.emos = p.emos;
  profileActionsShow.value = true;
}

function selectProfileAction(e: any) {
  const v = Number(e?.value);
  profileActionsShow.value = false;
  switch (v) {
    case 0:
      editProfileName.value = selectedProfile.name || "";
      editProfileShow.value = true;
      break;
    case 1:
      confirmDeleteProfile();
      break;
    default:
      break;
  }
}

function confirmEditProfile() {
  const name = editProfileName.value.trim();
  if (!name) {
    uni.showToast({ title: "请输入对象名称", icon: "none", duration: 2000 });
    return;
  }
  updateProfileName(selectedProfile.id, name);
  editProfileShow.value = false;
}

function confirmDeleteProfile() {
  if (profileList.value.length <= 1) {
    uni.showToast({ title: "至少保留一个对象", icon: "none", duration: 2000 });
    return;
  }
  uni.showModal({
    title: "删除确认",
    content: `是否删除对象“${selectedProfile.name}”及其所有情绪记录？`,
    success: function (res) {
      if (res.confirm) {
        deleteProfile(selectedProfile.id);
      }
    },
  });
}

function openCreateProfile() {
  newProfileName.value = "";
  createProfileShow.value = true;
}

function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    uni.showToast({ title: "请输入对象名称", icon: "none", duration: 2000 });
    return;
  }
  createProfile(name);
  createProfileShow.value = false;
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
}
.profile-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.profile-name {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.profile-meta {
  font-size: 12px;
  color: #999;
}
.sep {
  margin: 0 6px;
}
</style>
