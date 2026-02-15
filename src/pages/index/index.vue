<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      title="情绪记录App"
      left-icon=""
      right-icon="plus-circle"
      @right-click="toAddEmo"
      :placeholder="true"
    >
      <template #left>
        <ParseUploadData />
      </template>
    </up-navbar>
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
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { storeToRefs } from "pinia";
import { cloneDeep } from "lodash";
import { useEmoStore } from "@/stores/user";
import type { EmoType } from "@/common/interfaces";
import ParseUploadData from "./components/parse-upload-data.vue";
import EditEmoModal from "./components/edit-emo-modal.vue";

const store = useEmoStore();
const { deleteEmo } = store;
const { emoList } = storeToRefs(store);
let selectedEmo = reactive<EmoType>({} as EmoType); // 长按选中的情绪
let emoActionsShow = ref<boolean>(false); // 操作情绪抽屉显示状态
const emoActions = [
  {
    value: 0,
    name: "编辑名称",
  },
  {
    value: 1,
    name: "删除情绪",
  },
];
let editEmoShow = ref<boolean>(false); // 编辑情绪弹窗显示状态

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
    default:
      break;
  }
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
    url: `/pages/emo/detail?id=${id}`,
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
