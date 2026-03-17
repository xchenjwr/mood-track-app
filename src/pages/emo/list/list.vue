<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="navTitle"
      left-icon="arrow-left"
      @left-click="goBack"
      right-icon="plus-circle"
      @right-click="toAddEmo"
      :placeholder="true"
    />
    <!-- 情绪列表 -->
    <view v-if="emoList.length" class="emo-list">
      <up-card
        v-for="item in emoList"
        :key="item.id"
        :showHead="false"
        @longpress="opraEmo(item)"
      >
        <template #body>
          <view class="emo-cell">
            <view @click="toEmoDetail(item.id)">{{ item.name }}</view>
            <view class="emo-cell-right" @click="toCreateRecord(item)">
              <up-badge
                class="badge"
                type="error"
                :value="item.record.length"
              ></up-badge>
              <up-icon name="arrow-right"></up-icon>
            </view>
          </view>
        </template>
      </up-card>
    </view>
    <up-empty v-else class="no-list-data" mode="list" />
    <!-- 操作情绪抽屉 -->
    <up-action-sheet
      :show="emoActionsShow"
      :actions="emoActions"
      @select="selectAction"
      @close="emoActionsShow = false"
    />
    <!-- 修改情绪弹窗 -->
    <EditEmoModal
      v-model:show="editEmoShow"
      :id="selectedEmo.id"
      :name="selectedEmo.name"
    />
    <!-- 转移情绪到对象 -->
    <up-picker
      :show="transferProfileShow"
      :columns="profileColumns"
      keyName="text"
      valueName="value"
      @confirm="transferEmoConfirm"
      @cancel="transferProfileShow = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { storeToRefs } from "pinia";
import { cloneDeep } from "lodash";
import { useEmoStore } from "@/stores/user";
import type { EmoType } from "@/common/interfaces";
import EditEmoModal from "@/pages/index/components/edit-emo-modal.vue";

const store = useEmoStore();
const { deleteEmo, transferEmoToProfile, switchProfile } = store;
const { emoList, profileList, currentProfileName, data } = storeToRefs(store);

let selectedEmo = reactive<EmoType>({} as EmoType); // 长按选中的情绪
let emoActionsShow = ref<boolean>(false); // 操作情绪抽屉显示状态
const emoActions = [
  { value: 0, name: "编辑名称" },
  { value: 1, name: "删除情绪" },
  { value: 2, name: "转移到对象" },
];
let editEmoShow = ref<boolean>(false); // 编辑情绪弹窗显示状态
let transferProfileShow = ref<boolean>(false);

const navTitle = computed(() => {
  const n = currentProfileName.value || "";
  return n ? `情绪（${n}）` : "情绪";
});

const profileColumns = computed(() => [
  profileList.value
    .filter((p) => p.id !== data.value.currentProfileId)
    .map((p) => ({ text: p.name, value: p.id })),
]);

function goBack() {
  uni.navigateBack();
}

// 增加情绪页
function toAddEmo() {
  uni.navigateTo({
    url: "/pages/emo/create",
  });
}

// 创建新的记录
function toCreateRecord(item?: EmoType) {
  const emoItem: EmoType = item || selectedEmo;
  uni.navigateTo({
    url: `/pages/emo/create?id=${emoItem.id}`,
  });
}

// 长按操作情绪
function opraEmo(item: EmoType) {
  selectedEmo = cloneDeep(item);
  emoActionsShow.value = true;
}

// 情绪更多操作
function selectAction(e: any) {
  const { value } = e;
  switch (value) {
    case 0:
      editEmoShow.value = true;
      break;
    case 1:
      delEmo();
      break;
    case 2:
      openTransferProfile();
      break;
    default:
      break;
  }
}

function openTransferProfile() {
  if (!profileColumns.value[0]?.length) {
    uni.showToast({
      title: "请先在设置页新增对象",
      icon: "none",
      duration: 2500,
    });
    return;
  }
  transferProfileShow.value = true;
}

function transferEmoConfirm(e: any) {
  transferProfileShow.value = false;
  const target = e?.value?.[0];
  if (!target?.value) return;
  uni.showModal({
    title: "转移确认",
    content: `是否将情绪“${selectedEmo.name}”转移到${target.text}？`,
    success: function (res) {
      if (res.confirm) {
        transferEmoToProfile(selectedEmo.id, target.value);
        switchProfile(target.value);
      }
    },
  });
}

// 删除情绪
function delEmo() {
  uni.showModal({
    title: "删除确认",
    content: `是否删除${selectedEmo.name}情绪及其记录`,
    success: function (res) {
      if (res.confirm) {
        deleteEmo(selectedEmo.id);
      }
    },
  });
}

// 进入情绪详情页
function toEmoDetail(id: number) {
  uni.navigateTo({
    url: `/pages/emo/detail/detail?id=${id}`,
  });
}
</script>

<style lang="less">
.emo-list {
  padding: 10px;
  .emo-cell {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .emo-cell-right {
      display: flex;
      margin-left: auto;
      gap: 10px;
    }
  }
}
</style>

