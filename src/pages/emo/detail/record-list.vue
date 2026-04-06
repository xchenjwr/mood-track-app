<template>
  <view>
    <!-- 记录列表 -->
    <view v-if="records?.length" class="record">
      <view class="record-list">
        <up-card
          class="record-card"
          :showHead="false"
          v-for="item in records"
          :key="item.id"
          @longpress="opraRecord(item)">
          <template #body>
            <view>
              <view class="record-desc">
                {{ item.desc || "暂无描述" }}
              </view>
              <view class="record-time">
                {{ smartFormatTime(item.time * 1000) }}
              </view>
            </view>
          </template>
        </up-card>
      </view>
    </view>
    <up-empty v-else class="no-list-data" mode="list" />
    <!-- 操作记录抽屉 -->
    <up-action-sheet
      :show="recordActionsShow"
      :actions="recordActions"
      @select="selectAction"
      @close="recordActionsShow = false" />
    <!-- 转移记录抽屉 -->
    <up-picker
      :show="transferShow"
      :columns="emoColumns"
      keyName="text"
      valueName="value"
      @confirm="transferRecordToOther"
      @cancel="transferShow = false" />

    <!-- 编辑记录弹窗 -->
    <up-modal
      :show="editRecordShow"
      title="修改记录"
      showCancelButton
      @confirm="confirmEditRecord"
      @cancel="editRecordShow = false">
      <view class="record-edit-wrap">
        <up-textarea
          v-model="editDesc"
          placeholder="记录描述（50字以内）"
          maxlength="50"
          count
          :height="100" />
      </view>
    </up-modal>
  </view>
</template>
<script setup lang="ts">
import { ref, reactive, computed, toRefs } from "vue";
import { storeToRefs } from "pinia";
import { cloneDeep } from "lodash";
import { onLoad } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";
import { smartFormatTime } from "@/utils";
import type { EmoType, RecordType } from "@/common/interfaces";

interface Props {
  emoData: EmoType;
}
const props = defineProps<Props>();
const { emoData } = toRefs(props); // 情绪详情数据

const store = useEmoStore();
const { emoList } = storeToRefs(store);
const { getEmo, deleteRecord, transferRecord, updateRecord } = store;
let records = computed(
  () =>
    emoData.value?.record?.sort(
      (x: RecordType, y: RecordType) => y.time - x.time
    ) || []
); // 记录按照时间降序
let selectedRecord = reactive<RecordType>({} as RecordType); // 长按选中的记录
let recordActionsShow = ref<boolean>(false); // 操作记录抽屉显示状态
const recordActions = [
  {
    value: 0,
    name: "修改记录",
  },
  {
    value: 1,
    name: "转移到其他情绪",
  },
  {
    value: 2,
    name: "删除记录",
  },
];
let transferShow = ref<boolean>(false); // 转移记录抽屉显示状态
let emoColumns = computed(() => [
  emoList.value
    .filter((item: EmoType) => item.id !== emoData.value?.id)
    .map((item: EmoType) => ({
      text: item.name,
      value: item.id,
    })),
]); // 情绪列表

// 长按操作记录
function opraRecord(item: RecordType) {
  selectedRecord = cloneDeep(item);
  recordActionsShow.value = true;
}

// 情绪更多操作
function selectAction(e: any) {
  const { value } = e;
  switch (value) {
    case 0:
      editRecord();
      break;
    case 1:
      if (!emoColumns.value[0]?.length) {
        uni.showToast({
          title: "没有其他情绪可转移",
          icon: "none",
          duration: 2000,
        });
      } else {
        transferShow.value = true;
      }
      break;
    case 2:
      delRecord();
      break;
    default:
      break;
  }
}

// 编辑记录弹窗相关
const editRecordShow = ref(false);
const editDesc = ref("");

function editRecord() {
  editDesc.value = selectedRecord.desc || "";
  editRecordShow.value = true;
}

function confirmEditRecord() {
  const desc = editDesc.value.trim();
  if (!desc) {
    uni.showToast({ title: "请输入记录描述", icon: "none", duration: 2000 });
    return;
  }
  updateRecord(emoData.value.id, selectedRecord.id, desc);
  editRecordShow.value = false;
  uni.showToast({ title: "修改成功", icon: "success", duration: 2000 });
}

// 转移记录
function transferRecordToOther(e: any) {
  transferShow.value = false;
  const target = e?.value?.[0];
  if (!target?.value) {
    uni.showToast({ title: "没有可转移的情绪", icon: "none", duration: 2000 });
    return;
  }
  uni.showModal({
    title: "转移确认",
    content: `是否将该条记录从${emoData.value.name}转移到${target.text}?`,
    success: function (res) {
      if (res.confirm) {
        transferRecord(emoData.value.id, selectedRecord.id, target.value);
        uni.showToast({ title: "转移成功", icon: "success", duration: 2000 });
      }
    },
  });
}

// 删除记录
function delRecord() {
  uni.showModal({
    title: "删除确认",
    content: "是否删除该条记录",
    success: function (res) {
      if (res.confirm) {
        deleteRecord(emoData.value.id, selectedRecord.id);
        uni.showToast({ title: "删除成功", icon: "success", duration: 2000 });
      }
    },
  });
}
</script>

<style lang="less">
.record {
  padding: 0 10px;
  .record-total {
    color: grey;
  }
  .record-card {
    margin: 15px 0 0 0 !important;
    .record-desc {
      font-size: 14px;
    }
    .record-time {
      text-align: right;
      font-size: 10px;
      color: #bbb;
    }
  }
}

.record-edit-wrap {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;

  :deep(.u-textarea) {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
}
</style>
