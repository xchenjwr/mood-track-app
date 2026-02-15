<template>
  <view>
    <!-- 导航栏 -->
    <up-navbar
      :title="emoData?.name"
      left-icon="arrow-left"
      @left-click="goBack"
      :placeholder="true"
    />
    <!-- 记录列表 -->
    <view v-if="records?.length" class="record">
      <view class="record-total">共{{ records?.length }}条记录</view>
      <view class="record-list">
        <up-card
          class="record-card"
          :showHead="false"
          v-for="item in records"
          :key="item.id"
          @longpress="opraRecord(item)"
        >
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
      @close="recordActionsShow = false"
    />
    <!-- 转移记录抽屉 -->
    <up-picker
      :show="transferShow"
      :columns="emoColumns"
      keyName="text"
      valueName="value"
      @confirm="transferRecordToOther"
      @cancel="transferShow = false"
    />
  </view>
</template>
<script lang="ts" setup>
import { ref, reactive, computed } from "vue";
import { storeToRefs } from "pinia";
import { cloneDeep } from "lodash";
import { onLoad } from "@dcloudio/uni-app";
import { useEmoStore } from "@/stores/user";
import { smartFormatTime } from "@/utils";

const store = useEmoStore();
const { emoList } = storeToRefs(store);
const { getEmo, deleteRecord, transferRecord } = store;
let emoData = reactive({}); // 情绪详情数据
let records = computed(
  () =>
    emoData.record?.sort((x: RecordType, y: RecordType) => y.time - x.time) ||
    [],
); // 记录按照时间降序
let selectedRecord = reactive<RecordType>({} as RecordType); // 长按选中的记录
let recordActionsShow = ref<boolean>(false); // 操作记录抽屉显示状态
const recordActions = [
  {
    value: 0,
    name: "编辑记录",
  },
  {
    value: 1,
    name: "转移记录",
  },
  {
    value: 2,
    name: "删除记录",
  },
];
let transferShow = ref<boolean>(false); // 转移记录抽屉显示状态
let emoColumns = computed(() => [
  emoList.value
    .filter((item: EmoType) => item.id !== emoData.id)
    .map((item: EmoType) => ({
      text: item.name,
      value: item.id,
    })),
]); // 情绪列表

onLoad((option: any) => {
  const id = Number(option.id) || 0;
  if (id) {
    emoData = getEmo(id);
  }
});

// 返回主页
function goBack() {
  uni.navigateTo({
    url: "/pages/index/index",
  });
}

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
      transferShow.value = true;
      break;
    case 2:
      delRecord();
      break;
    default:
      break;
  }
}

// 编辑记录
function editRecord() {
  uni.navigateTo({
    url: `/pages/emo/create?id=${emoData.id}&rid=${selectedRecord.id}`,
  });
}

// 转移记录
function transferRecordToOther(e: any) {
  transferShow.value = false;
  uni.showModal({
    title: "转移确认",
    content: `是否将该条记录从${emoData.name}转移到${e.value[0].text}?`,
    success: function (res) {
      if (res.confirm) {
        transferRecord(emoData.id, selectedRecord.id, e.value[0].value);
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
        deleteRecord(emoData.id, selectedRecord.id);
      }
    },
  });
}
</script>
<style lang="less">
.record {
  padding: 15px;
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
</style>
